import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { user, product, order, cart } from "~/infra/database/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "~/server/auth";
import { logActivity } from "~/routes/api/[...paths]";

const verifyAuth = async (c: any, next: any) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ success: false, reason: "Unauthorized" }, 401);
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, session.user.id) });
    if (dbUser?.profile && (dbUser.profile as any).banned) {
      return c.json({ success: false, reason: "Banned", message: "Tài khoản của bạn đã bị khóa." }, 403);
    }
    c.set("user", dbUser || session.user);
    await next();
  } catch (e: any) {
    console.error("verifyAuth Error:", e);
    return c.json({ error: "Auth verification failed", details: e.message }, 500);
  }
};

const cancelOrder = async (o: any) => {
  const [updated] = await db.update(order).set({ status: "cancelled" }).where(eq(order.id, o.id)).returning();

  if (o.shippingInfo && (o.shippingInfo as any).preorderApproved) {
    const cartItems = (o.cart as any[]) || [];
    for (const item of cartItems) {
      const pid = item.goods || item._id || item.id;
      const dbProd = await db.query.product.findFirst({ where: eq(product.id, pid) });
      if (dbProd) {
        const newQty = (dbProd.quantity ?? 0) + (item.quantity || 1);
        await db.update(product).set({ quantity: newQty }).where(eq(product.id, pid));
      }
    }
  }
  return updated || o;
};

export function registerOrderRoutes(app: Hono) {
  app.get("/orders", verifyAuth, async (c: any) => {
    const userObj = c.get("user");
    try {
      let userOrders;
      if (userObj.role === "seller" || userObj.role === "ai") {
        const allOrders = await db.select().from(order).orderBy(order.addAt);
        userOrders = allOrders.filter((o: any) => {
          const cartItems = Array.isArray(o.cart) ? o.cart : o.cart && Array.isArray(o.cart.items) ? o.cart.items : [];
          return cartItems.some((item: any) => item.sellerId === userObj.id || item.item?.sellerId === userObj.id);
        });
      } else if (userObj.role === "admin") {
        userOrders = await db.select().from(order).orderBy(order.addAt);
      } else {
        userOrders = await db.select().from(order).where(eq(order.userId, userObj.id)).orderBy(order.addAt);
      }

      const now = Date.now();
      const processedOrders = [];

      for (const o of userOrders) {
        let currentOrder = o;
        if (!o.paid && o.status === "pending" && o.paymentExpireAt && now > new Date(o.paymentExpireAt).getTime()) {
          currentOrder = await cancelOrder(o);
        }

        const buyerObj = await db.query.user.findFirst({
          where: eq(user.id, currentOrder.userId),
        });

        processedOrders.push({
          ...currentOrder,
          buyer: buyerObj
            ? {
                id: buyerObj.id,
                name: buyerObj.name,
                email: buyerObj.email,
                image: buyerObj.image,
                username: buyerObj.username,
              }
            : null,
        });
      }

      return c.json({ success: true, orders: processedOrders });
    } catch (error: any) {
      return c.json({ success: false, message: error.message }, 500);
    }
  });

  app.post("/orders", verifyAuth, async (c: any) => {
    const userObj = c.get("user");
    const body = await c.req.json();

    if (!body.cart || body.cart.length === 0) {
      return c.json({ success: false, message: "Cart is empty" }, 400);
    }

    try {
      let isPreorder = false;
      const productIds = body.cart.map((item: any) => item.goods || item._id || item.id).filter(Boolean);
      if (productIds.length > 0) {
        const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));

        for (const p of dbProducts) {
          if (p.sellerId === userObj.id) {
            return c.json({ success: false, message: `Bạn không thể mua sản phẩm của chính mình (${p.name})!` }, 400);
          }
          if (p.status === false || (p.quantity ?? 0) <= 0) {
            isPreorder = true;
          }
        }
      }

      const orderId = crypto.randomUUID();
      const expireTime = new Date(Date.now() + 60 * 1000).toISOString();

      const newOrder = await db
        .insert(order)
        .values({
          id: orderId,
          userId: userObj.id,
          cart: body.cart,
          shippingInfo: body.shippingInfo || {},
          shippingFee: body.shippingFee || 0,
          total: body.total || 0,
          status: isPreorder ? "preorder" : "pending",
          paid: false,
          paymentUrl: `/checkout/${orderId}`,
          paymentExpireAt: expireTime,
        })
        .returning();

      await logActivity(
        userObj.id,
        `${isPreorder ? "Đặt trước" : "Đặt đơn hàng"} #${orderId.substring(0, 8)}`,
        `Đơn hàng tổng cộng ${body.total || 0}đ`,
        "order",
        c.req.header("user-agent"),
      );

      return c.json({ success: true, order: newOrder[0] });
    } catch (error: any) {
      console.error("Order error:", error);
      return c.json({ success: false, message: error.message || "Lỗi máy chủ" }, 500);
    }
  });

  app.post("/orders/:id/pay", verifyAuth, async (c: any) => {
    const { id } = c.req.param();
    try {
      const existing = await db.query.order.findFirst({
        where: eq(order.id, id),
      });

      if (!existing) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      if (existing.paymentExpireAt && Date.now() > new Date(existing.paymentExpireAt).getTime()) {
        await cancelOrder(existing);
        return c.json({ success: false, message: "Hạn mức thanh toán đã hết! Đơn hàng bị hủy." }, 400);
      }

      const updated = await db
        .update(order)
        .set({
          paid: true,
          paidAt: new Date().toISOString(),
          status: "completed",
        })
        .where(eq(order.id, id))
        .returning();

      await logActivity(
        existing.userId,
        `Thanh toán thành công đơn hàng #${id.substring(0, 8)}`,
        `Đơn hàng trị giá ${existing.total || 0}đ đã được thanh toán thành công`,
        "payment",
        c.req.header("user-agent"),
      );

      return c.json({ success: true, order: updated[0] });
    } catch (error: any) {
      return c.json({ success: false, message: error.message }, 500);
    }
  });

  app.post("/orders/:id/approve-preorder", verifyAuth, async (c: any) => {
    const { id } = c.req.param();
    const userObj = c.get("user");
    try {
      const existing = await db.query.order.findFirst({
        where: eq(order.id, id),
      });

      if (!existing) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      if (existing.status !== "preorder") {
        return c.json({ success: false, message: "Đơn hàng không ở trạng thái đặt trước." }, 400);
      }

      const cartItems = (existing.cart as any[]) || [];
      const productIds = cartItems.map((item: any) => item.goods || item._id || item.id).filter(Boolean);

      if (productIds.length > 0) {
        const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));
        const productMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));

        for (const item of cartItems) {
          const pid = item.goods || item._id || item.id;
          const dbProd = productMap.get(pid);
          if (!dbProd) {
            return c.json({ success: false, message: `Sản phẩm ${item.name || pid} không tồn tại trong hệ thống.` }, 400);
          }
          if (dbProd.status === false || (dbProd.quantity ?? 0) < (item.quantity || 1)) {
            return c.json(
              { success: false, message: `Không đủ tồn kho cho sản phẩm ${dbProd.name}. Hiện tại còn: ${dbProd.quantity || 0}` },
              400,
            );
          }
        }

        for (const item of cartItems) {
          const pid = item.goods || item._id || item.id;
          const dbProd = productMap.get(pid)!;
          const newQty = (dbProd.quantity ?? 0) - (item.quantity || 1);
          await db.update(product).set({ quantity: newQty }).where(eq(product.id, pid));

          await logActivity(
            userObj.id,
            `Giữ chỗ sản phẩm '${dbProd.name}'`,
            `Giữ chỗ ${item.quantity || 1} sản phẩm cho đơn đặt trước #${id.substring(0, 8)}. Số lượng tồn kho mới: ${newQty}`,
            "product",
            c.req.header("user-agent"),
          );
        }
      }

      const expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const newShippingInfo = {
        ...((existing.shippingInfo as any) || {}),
        preorderApproved: true,
      };

      const updated = await db
        .update(order)
        .set({
          status: "pending",
          paymentExpireAt: expireTime,
          paymentUrl: `/checkout/${id}`,
          shippingInfo: newShippingInfo,
        })
        .where(eq(order.id, id))
        .returning();

      await logActivity(
        userObj.id,
        `Phê duyệt đặt trước đơn hàng #${id.substring(0, 8)}`,
        `Duyệt đơn đặt trước thành đơn hàng thanh toán trị giá ${existing.total || 0}đ`,
        "order",
        c.req.header("user-agent"),
      );

      return c.json({ success: true, order: updated[0] });
    } catch (error: any) {
      return c.json({ success: false, message: error.message }, 500);
    }
  });

  app.get("/cart", verifyAuth, async (c: any) => {
    const userObj = c.get("user");
    try {
      const cartItems = await db
        .select({
          cartId: cart.id,
          quantity: cart.quantity,
          product: product,
        })
        .from(cart)
        .innerJoin(product, eq(cart.productId, product.id))
        .where(eq(cart.userId, userObj.id));

      const formattedCart = cartItems.map((item: any) => ({
        _id: item.product.id,
        goods: item.product.id,
        quantity: item.quantity,
        item: item.product,
      }));

      return c.json({ success: true, cart: formattedCart });
    } catch (error: any) {
      return c.json({ success: false, message: error.message }, 500);
    }
  });

  app.post("/cart", verifyAuth, async (c: any) => {
    const userObj = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const { cart: newCartItems } = body;

    if (!Array.isArray(newCartItems)) {
      return c.json({ success: false, message: "Invalid cart format" }, 400);
    }

    try {
      const productIds = newCartItems.map((item: any) => item.goods || item._id || item.id).filter(Boolean);
      const validProductIds = new Set<string>();

      if (productIds.length > 0) {
        const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));

        for (const p of dbProducts) {
          if (p.sellerId === userObj.id) {
            return c.json({ success: false, message: `Bạn không thể thêm sản phẩm của chính mình (${p.name}) vào giỏ hàng!` }, 400);
          }
          validProductIds.add(p.id);
        }
      }

      await db.delete(cart).where(eq(cart.userId, userObj.id));

      if (newCartItems.length > 0) {
        const insertData = newCartItems
          .map((item: any) => {
            const pid = item.goods || item._id || item.id;
            return {
              id: crypto.randomUUID(),
              userId: userObj.id,
              productId: pid,
              quantity: item.quantity || 1,
            };
          })
          .filter((item) => item.productId && validProductIds.has(item.productId));

        if (insertData.length > 0) {
          await db.insert(cart).values(insertData);
        }
      }

      return c.json({ success: true, message: "Cart synced successfully" });
    } catch (error: any) {
      console.error("Sync cart error:", error);
      return c.json({ success: false, message: error.message }, 500);
    }
  });
}
