1. /api/v1/search để tìm luật liên quan
2. /api/v1/document/{id} để lấy metadata + nội dung
3. /api/v1/effects/{id} để biết còn hiệu lực hay bị thay thế
4. /api/v1/timeline/{id} để biết lịch sử văn bản
5. /api/v1/dump để build RAG local
Nếu chỉ chọn 1 cái:
https://vietlex.vn/api/v1
Endpoint quan trọng nhất:
GET /api/v1/search
GET /api/v1/document/{id}
GET /api/v1/effects/{id}
GET /api/v1/timeline/{id}
GET /api/v1/dump
VBPL: crawl từ https://vbpl.vn/ hoặc https://phapluat.gov.vn/he-thong-van-ban-phap-luat
