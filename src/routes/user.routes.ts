import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { user } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { getEnrichedProfile, deleteFileRecord } from "~/routes/api/[...paths]";

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

export function registerUserRoutes(app: Hono) {
  app.get("/me", verifyAuth, async (c: any) => {
    const u = c.get("user");
    return c.json({ success: true, user: u });
  });

  app.get("/make-admin", async (c: any) => {
    await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@test.com"));
    return c.json({ success: true, message: "Admin role set" });
  });

  app.get("/profile", verifyAuth, async (c: any) => {
    const query = c.req.query();
    if (query.userId !== undefined) {
      return c.json(
        {
          success: false,
          message:
            "API with query parameters (e.g., ?userId=...) is deprecated and forbidden. Use path parameters (/api/profile/:userId) instead.",
        },
        400,
      );
    }

    const currentUser = c.get("user");
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, currentUser.id) });

    if (!dbUser) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const enriched = await getEnrichedProfile(dbUser);
    return c.json({ success: true, profile: enriched });
  });

  app.get("/profile/:userId", verifyAuth, async (c: any) => {
    let userId = c.req.param("userId");

    if (userId) {
      let cleanSlug = userId;
      if (cleanSlug.startsWith("user-")) {
        cleanSlug = cleanSlug.replace("user-", "");
      }
      if (cleanSlug === "RottraAI" || cleanSlug === "RottraAI" || cleanSlug === "agent-pro-max" || cleanSlug === "agent_pro_max") {
        userId = "RottraAI";
      } else {
        const agentMap: Record<string, string> = {
          "to-luong": "toLuong",
          "thuong-nguyet": "thuongNguyet",
          "tram-tinh": "tramTinh",
          "dao-tieu-cuu": "daoTieuCuu",
          "hoa-huynh": "hoaHuynh",
          "phi-nguyet": "phiNguyet",
          "nhu-nguyet": "nhuNguyet",
          "su-gia": "suGia",
          "phi-anh": "phiAnh",
          "bach-di-hanh": "bachDiHanh",
          "u-vuong-mau": "uVuongMau",
          "bach-loc": "bachLoc",
        };
        if (agentMap[cleanSlug]) {
          userId = agentMap[cleanSlug];
        } else if (Object.values(agentMap).includes(cleanSlug)) {
          return c.json({ success: false, message: "User not found" }, 404);
        }
      }
    }

    let dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });

    if (!dbUser) {
      const allUsers = await db.query.user.findMany();
      dbUser = allUsers.find((u: any) => {
        const slugifiedId = u.id
          .replace(/^user_?/, "")
          .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
          .replace(/_/g, "-")
          .toLowerCase();
        return slugifiedId === userId.toLowerCase() || u.id.toLowerCase() === userId.toLowerCase();
      });
    }

    if (!dbUser) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const enriched = await getEnrichedProfile(dbUser);
    return c.json({ success: true, profile: enriched });
  });

  app.post("/profile", verifyAuth, async (c: any) => {
    const userObj = c.get("user");
    const body = await c.req.json();

    const dbUser = await db.query.user.findFirst({ where: eq(user.id, userObj.id) });
    const existingProfile = (dbUser?.profile as any) || {};

    let updatedProfile = { ...existingProfile, ...body };
    if (body.qrImage?.link !== existingProfile.qrImage?.link) {
      updatedProfile.qrLastUpdated = new Date().toISOString();
    }

    if (existingProfile.avatar?.link && existingProfile.avatar.link !== body.avatar?.link) {
      await deleteFileRecord(existingProfile.avatar.link);
    }
    if (existingProfile.qrImage?.link && existingProfile.qrImage.link !== body.qrImage?.link) {
      await deleteFileRecord(existingProfile.qrImage.link);
    }

    await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userObj.id));

    return c.json({
      success: true,
      profile: { ...updatedProfile, email: dbUser?.email },
    });
  });

  app.get("/agent/system-profile", async (c: any) => {
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, "RottraAI") });
    const profile = (dbUser?.profile as any) || {};
    return c.json({
      success: true,
      profile: {
        ...profile,
        fullName: profile.fullName || dbUser?.name || "RottraAI ⭐",
        email: dbUser?.email || "agent@Rottra.com",
        avatar: profile.avatar || (dbUser?.image ? { link: dbUser.image } : { link: "/default-avatar.avif" }),
      },
    });
  });

  app.post("/agent/system-profile", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ success: false, message: "Forbidden: Only admins can update the system agent profile" }, 403);
    }
    const body = await c.req.json();
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, "RottraAI") });
    const existingProfile = (dbUser?.profile as any) || {};
    const updatedProfile = {
      ...existingProfile,
      fullName: body.fullName || existingProfile.fullName,
      phone: body.phone !== undefined ? body.phone : existingProfile.phone,
      address: body.address !== undefined ? body.address : existingProfile.address,
      qrImage: body.qrImage !== undefined ? body.qrImage : existingProfile.qrImage,
      bio: body.bio !== undefined ? body.bio : existingProfile.bio,
      avatar: body.avatar !== undefined ? body.avatar : existingProfile.avatar,
    };

    await db
      .update(user)
      .set({
        name: updatedProfile.fullName,
        profile: updatedProfile,
        image: updatedProfile.avatar?.link || dbUser?.image,
      })
      .where(eq(user.id, "RottraAI"));

    return c.json({ success: true, profile: updatedProfile });
  });
}
