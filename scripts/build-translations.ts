#!/usr/bin/env bun
/**
 * Generate pre-translated JSON files using Google Translate free endpoint.
 * No API key, no models needed. Just HTTP requests.
 *
 * Output: public/translations/{en,zh,ja,fi,he}.json
 *
 * Usage: bun scripts/build-translations.ts
 */

import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "public", "translations");
const TARGET_LANGS = ["en", "zh", "ja", "fi", "he"];
const BATCH_SIZE = 20;

const VI_STRINGS: Record<string, string> = {
  "nav.home": "Trang chủ",
  "nav.products": "Sản phẩm",
  "nav.cart": "Giỏ hàng",
  "nav.profile": "Hồ sơ",
  "nav.orders": "Đơn hàng",
  "nav.settings": "Cài đặt",
  "nav.logout": "Đăng xuất",
  "nav.login": "Đăng nhập",
  "nav.register": "Đăng ký",
  "nav.search": "Tìm kiếm",
  "nav.categories": "Danh mục",
  "nav.about": "Giới thiệu",
  "nav.contact": "Liên hệ",
  "common.save": "Lưu",
  "common.cancel": "Hủy",
  "common.delete": "Xóa",
  "common.edit": "Chỉnh sửa",
  "common.add": "Thêm",
  "common.remove": "Bỏ",
  "common.confirm": "Xác nhận",
  "common.close": "Đóng",
  "common.back": "Quay lại",
  "common.next": "Tiếp theo",
  "common.previous": "Trước đó",
  "common.loading": "Đang tải...",
  "common.error": "Lỗi",
  "common.success": "Thành công",
  "common.warning": "Cảnh báo",
  "common.no_data": "Không có dữ liệu",
  "common.view_all": "Xem tất cả",
  "common.learn_more": "Tìm hiểu thêm",
  "common.read_more": "Đọc thêm",
  "common.share": "Chia sẻ",
  "common.copy": "Sao chép",
  "common.download": "Tải xuống",
  "common.upload": "Tải lên",
  "common.refresh": "Làm mới",
  "common.filter": "Lọc",
  "common.sort": "Sắp xếp",
  "common.all": "Tất cả",
  "common.none": "Không",
  "product.price": "Giá",
  "product.add_to_cart": "Thêm vào giỏ",
  "product.buy_now": "Mua ngay",
  "product.out_of_stock": "Hết hàng",
  "product.in_stock": "Còn hàng",
  "product.description": "Mô tả",
  "product.reviews": "Đánh giá",
  "product.rating": "Đánh giá",
  "product.quantity": "Số lượng",
  "product.total": "Tổng cộng",
  "product.discount": "Giảm giá",
  "product.new": "Mới",
  "product.featured": "Nổi bật",
  "product.best_seller": "Bán chạy",
  "product.related": "Sản phẩm liên quan",
  "product.specifications": "Thông số kỹ thuật",
  "product.material": "Chất liệu",
  "product.origin": "Xuất xứ",
  "product.weight": "Khối lượng",
  "product.category": "Danh mục",
  "cart.title": "Giỏ hàng",
  "cart.empty": "Giỏ hàng trống",
  "cart.subtotal": "Tạm tính",
  "cart.shipping": "Phí vận chuyển",
  "cart.tax": "Thuế",
  "cart.total": "Tổng cộng",
  "cart.checkout": "Thanh toán",
  "cart.continue_shopping": "Tiếp tục mua sắm",
  "cart.remove_item": "Xóa sản phẩm",
  "cart.update_quantity": "Cập nhật số lượng",
  "auth.login_title": "Đăng nhập",
  "auth.register_title": "Đăng ký",
  "auth.email": "Email",
  "auth.password": "Mật khẩu",
  "auth.confirm_password": "Xác nhận mật khẩu",
  "auth.forgot_password": "Quên mật khẩu?",
  "auth.remember_me": "Ghi nhớ đăng nhập",
  "auth.login_button": "Đăng nhập",
  "auth.register_button": "Đăng ký",
  "auth.or_login_with": "Hoặc đăng nhập với",
  "auth.no_account": "Chưa có tài khoản?",
  "auth.has_account": "Đã có tài khoản?",
  "order.title": "Đơn hàng",
  "order.history": "Lịch sử đơn hàng",
  "order.status": "Trạng thái",
  "order.pending": "Đang chờ",
  "order.processing": "Đang xử lý",
  "order.shipped": "Đã giao hàng",
  "order.delivered": "Đã nhận",
  "order.cancelled": "Đã hủy",
  "order.total": "Tổng đơn hàng",
  "order.date": "Ngày đặt",
  "order.detail": "Chi tiết đơn hàng",
  "order.tracking": "Theo dõi đơn hàng",
  "profile.title": "Hồ sơ",
  "profile.edit": "Chỉnh sửa hồ sơ",
  "profile.name": "Họ và tên",
  "profile.phone": "Số điện thoại",
  "profile.address": "Địa chỉ",
  "profile.avatar": "Ảnh đại diện",
  "profile.change_password": "Đổi mật khẩu",
  "profile.my_orders": "Đơn hàng của tôi",
  "profile.wishlist": "Danh sách yêu thích",
  "profile.settings": "Cài đặt",
  "home.welcome": "Chào mừng đến với Rottra",
  "home.subtitle": "Nông sản cao cấp",
  "home.shop_now": "Mua sắm ngay",
  "home.view_products": "Xem sản phẩm",
  "home.featured_products": "Sản phẩm nổi bật",
  "home.new_arrivals": "Sản phẩm mới",
  "home.categories": "Danh mục",
  "home.promotions": "Khuyến mãi",
  "home.about_us": "Về chúng tôi",
  "home.why_choose_us": "Tại sao chọn chúng tôi",
  "home.quality": "Chất lượng cao",
  "home.organic": "Hữu cơ",
  "home.fast_shipping": "Giao hàng nhanh",
  "home.support": "Hỗ trợ 24/7",
  "footer.about": "Về Rottra",
  "footer.terms": "Điều khoản",
  "footer.privacy": "Chính sách bảo mật",
  "footer.faq": "Câu hỏi thường gặp",
  "footer.support": "Hỗ trợ",
  "footer.copyright": "© 2026 Rottra. Tất cả quyền được bảo lưu.",
  "msg.added_to_cart": "Đã thêm vào giỏ hàng",
  "msg.removed_from_cart": "Đã xóa khỏi giỏ hàng",
  "msg.order_placed": "Đặt hàng thành công",
  "msg.payment_success": "Thanh toán thành công",
  "msg.payment_failed": "Thanh toán thất bại",
  "msg.profile_updated": "Cập nhật hồ sơ thành công",
  "msg.password_changed": "Đổi mật khẩu thành công",
  "msg.login_required": "Vui lòng đăng nhập",
  "msg.confirm_delete": "Bạn có chắc muốn xóa?",
  "msg.no_results": "Không tìm thấy kết quả",
};

const KEYS = Object.keys(VI_STRINGS);
const VI_VALUES = Object.values(VI_STRINGS);

async function googleTranslate(texts: string[], targetLang: string): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const joined = batch.join("\n");

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      // Response format: [[["translated","original",...],...],...]
      const translated = data[0].map((item: any) => item[0]).join("");
      const parts = translated.split("\n");
      results.push(...parts);
    } catch (err: any) {
      console.warn("  Batch error: " + err.message + ", using originals");
      results.push(...batch);
    }

    process.stdout.write("  " + Math.min(i + BATCH_SIZE, texts.length) + "/" + texts.length + "\r");
  }

  console.log("");
  return results;
}

async function main() {
  console.log("========================================");
  console.log("  Build Translations JSON (Google Translate)");
  console.log("  " + VI_VALUES.length + " strings x 5 languages");
  console.log("========================================\n");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const lang of TARGET_LANGS) {
    console.log("--- " + lang + " ---");
    console.log("  Translating " + VI_VALUES.length + " strings vi→" + lang + "...");

    const translations = await googleTranslate(VI_VALUES, lang);

    const output: Record<string, string> = {};
    for (let i = 0; i < KEYS.length; i++) {
      output[KEYS[i]] = translations[i] || VI_VALUES[i];
    }

    const outFile = path.join(OUTPUT_DIR, lang + ".json");
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf-8");

    const sizeKB = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log("  Saved: " + lang + ".json (" + sizeKB + " KB, " + Object.keys(output).length + " strings)\n");
  }

  console.log("========================================");
  console.log("  Done!");
  console.log("  Output: " + OUTPUT_DIR);
  console.log("========================================");
}

main().catch(console.error);
