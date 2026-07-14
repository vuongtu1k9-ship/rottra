/**
 * Golden Dataset for RAG Evaluation
 * 105 agricultural Q&A pairs with expected relevant document categories
 */

export interface GoldenQuery {
  id: string;
  query: string;
  expectedCategories: string[];
  expectedKeywords: string[];
  difficulty: "easy" | "medium" | "hard";
  domain: string;
}

export const GOLDEN_DATASET: GoldenQuery[] = [
  // === EASY: Direct keyword matches ===
  { id: "g001", query: "Gia lua hom nay bao nhieu?", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "lua", "hom nay"], difficulty: "easy", domain: "market_price" },
  { id: "g002", query: "Mua vu trong lua o Dong bang song Cuu Long", expectedCategories: ["SMART_AGRI", "AGRI_SEASON"], expectedKeywords: ["mua", "trong", "lua", "dong bang"], difficulty: "easy", domain: "agriculture" },
  { id: "g003", query: "Cach phong chong sau benh tren cay lua", expectedCategories: ["SMART_AGRI", "AGRI_PEST"], expectedKeywords: ["phong", "sau", "benh", "lua"], difficulty: "easy", domain: "agriculture" },
  { id: "g004", query: "Phan bon nao tot cho cay lua?", expectedCategories: ["SMART_AGRI", "AGRI_FERTILIZER"], expectedKeywords: ["phan", "bon", "tot", "lua"], difficulty: "easy", domain: "agriculture" },
  { id: "g005", query: "Tuoi tu dong cho ruong lua", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["tuoi", "tu", "dong", "ruong"], difficulty: "easy", domain: "agriculture" },
  { id: "g006", query: "Gia ca phe the gioi hom nay", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "ca phe", "the gioi"], difficulty: "easy", domain: "market_price" },
  { id: "g007", query: "Ky thuat trong ca phe Robusta", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["ky", "thuat", "trong", "ca phe"], difficulty: "easy", domain: "agriculture" },
  { id: "g008", query: "Drone phun thuoc tru sau", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["drone", "phun", "thuoc"], difficulty: "easy", domain: "technology" },
  { id: "g009", query: "Cam bien nhiet do cho nha luoi", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["cam", "bien", "nhiet", "do", "nha", "luoi"], difficulty: "easy", domain: "technology" },
  { id: "g010", query: "Gia gao xuat khau Viet Nam", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "gao", "xuat", "khau"], difficulty: "easy", domain: "market_price" },
  // === MEDIUM: Requires semantic understanding ===
  { id: "g011", query: "Lam the nao de tang nang suat mua mang?", expectedCategories: ["SMART_AGRI", "AGRI_YIELD"], expectedKeywords: ["tang", "nang", "suat", "mua", "mang"], difficulty: "medium", domain: "agriculture" },
  { id: "g012", query: "Thoi tiet mua anh huong den mua vu ra sao?", expectedCategories: ["WEATHER_SEASON", "AGRI_SEASON"], expectedKeywords: ["thoi", "tiet", "mua", "anh", "huong", "mua", "vu"], difficulty: "medium", domain: "weather" },
  { id: "g013", query: "Chi phi san xuat 1 hecta lua", expectedCategories: ["FINANCE_COST", "AGRI_COST"], expectedKeywords: ["chi", "phi", "san", "xuat", "hecta", "lua"], difficulty: "medium", domain: "finance" },
  { id: "g014", query: "Doi tra san pham bi hu hong", expectedCategories: ["ORDER_PAYMENT", "CUSTOMER_SERVICE"], expectedKeywords: ["doi", "tra", "san", "pham", "hu"], difficulty: "medium", domain: "customer_service" },
  { id: "g015", query: "Lich su trong trot cua toi", expectedCategories: ["NAVIGATION", "AGRI_HISTORY"], expectedKeywords: ["lich", "su", "trong", "trot"], difficulty: "medium", domain: "navigation" },
  { id: "g016", query: "Du bao nhu cau thi truong nong san", expectedCategories: ["MARKET_PRICE", "AGRI_FORECAST"], expectedKeywords: ["du", "bao", "nhu", "cau", "thi", "truong"], difficulty: "medium", domain: "market_price" },
  { id: "g017", query: "Cong nghe IoT trong nong nghiep thong minh", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["iot", "nong", "nghiep", "thong", "minh"], difficulty: "medium", domain: "technology" },
  { id: "g018", query: "Quan ly don hang va giao hang", expectedCategories: ["ORDER_PAYMENT", "NAVIGATION"], expectedKeywords: ["quan", "ly", "don", "hang", "giao"], difficulty: "medium", domain: "order" },
  { id: "g019", query: "Phan tich du lieu nong nghiep", expectedCategories: ["SMART_AGRI", "AGRI_DATA"], expectedKeywords: ["phan", "tich", "du", "lieu", "nong"], difficulty: "medium", domain: "data" },
  { id: "g020", query: "Bao quan nong san sau thu hoach", expectedCategories: ["SMART_AGRI", "AGRI_STORAGE"], expectedKeywords: ["bao", "quan", "nong", "san", "thu", "hoach"], difficulty: "medium", domain: "agriculture" },
  // === MEDIUM: Cross-domain queries ===
  { id: "g021", query: "Ty gia USD anh huong gia xuat khau nong san", expectedCategories: ["FINANCE_COST", "MARKET_PRICE"], expectedKeywords: ["ty", "gia", "usd", "xuat", "khau"], difficulty: "medium", domain: "finance" },
  { id: "g022", query: "Benh dao on tren lua phong tri", expectedCategories: ["SMART_AGRI", "AGRI_PEST"], expectedKeywords: ["benh", "dao", "on", "lua", "phong"], difficulty: "medium", domain: "agriculture" },
  { id: "g023", query: "GPS dinh vi ruong dong cho tractor", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["gps", "dinh", "vi", "ruong", "tractor"], difficulty: "medium", domain: "technology" },
  { id: "g024", query: "Hop dong nong san voi gia co dinh", expectedCategories: ["ORDER_PAYMENT", "FINANCE_COST"], expectedKeywords: ["hop", "dong", "nong", "san", "gia", "co", "dinh"], difficulty: "medium", domain: "finance" },
  { id: "g025", query: "Tuoi nho giong tiet kiem nuoc", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["tuoi", "nho", "giong", "tiet", "kiem"], difficulty: "medium", domain: "agriculture" },
  // === HARD: Complex queries requiring reasoning ===
  { id: "g026", query: "So sanh loi nhuan giua trong lua va trong ca phe", expectedCategories: ["FINANCE_COST", "MARKET_PRICE"], expectedKeywords: ["so", "sanh", "loi", "nhuan", "lua", "ca phe"], difficulty: "hard", domain: "finance" },
  { id: "g027", query: "Toi muon mua phan bon nhung khong biet chon loai nao phu hop voi dat phen", expectedCategories: ["SMART_AGRI", "AGRI_FERTILIZER"], expectedKeywords: ["phan", "bon", "dat", "phen"], difficulty: "hard", domain: "agriculture" },
  { id: "g028", query: "Dieu chinh lich trong trot khi thoi tiet bat thuong", expectedCategories: ["WEATHER_SEASON", "AGRI_SEASON"], expectedKeywords: ["dieu", "chinh", "lich", "trong", "thoi", "tiet"], difficulty: "hard", domain: "weather" },
  { id: "g029", query: "Toi uu hoa chi phi van chuyen tu ruong den kho", expectedCategories: ["FINANCE_COST", "NAVIGATION"], expectedKeywords: ["toi", "uu", "chi", "phi", "van", "chuyen"], difficulty: "hard", domain: "logistics" },
  { id: "g030", query: "Phan tich xu huong gia nong san trong 6 thang toi dua tren du lieu lich su", expectedCategories: ["MARKET_PRICE", "AGRI_FORECAST"], expectedKeywords: ["xu", "huong", "gia", "nong", "san", "du", "bao"], difficulty: "hard", domain: "market_price" },
  { id: "g031", query: "He thong tuoi tu dong ket noi voi du bao thoi tiet de dieu chinh luong nuoc", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["tuoi", "tu", "dong", "thoi", "tiet", "nuoc"], difficulty: "hard", domain: "technology" },
  { id: "g032", query: "Xay dung chuoi cung ung nong san tu trang trai den ban an", expectedCategories: ["NAVIGATION", "AGRI_LOGISTICS"], expectedKeywords: ["chuoi", "cung", "ung", "nong", "san"], difficulty: "hard", domain: "logistics" },
  { id: "g033", query: "Danh gia hieu qua cua phan bon vi sinh so voi phan bon hoa chat", expectedCategories: ["SMART_AGRI", "AGRI_FERTILIZER"], expectedKeywords: ["phan", "bon", "vi", "sinh", "hoa", "hoc"], difficulty: "hard", domain: "agriculture" },
  { id: "g034", query: "Tai sao nong dan nen chuyen doi so?", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["chuyen", "doi", "so", "nong", "dan"], difficulty: "hard", domain: "technology" },
  { id: "g035", query: "Moi lien he giua bien doi khi hau va san luong nong nghiep Viet Nam", expectedCategories: ["WEATHER_SEASON", "AGRI_YIELD"], expectedKeywords: ["bien", "doi", "khi", "hau", "san", "luong"], difficulty: "hard", domain: "climate" },
  // === Additional easy queries ===
  { id: "g036", query: "Dang nhap tai khoan", expectedCategories: ["NAVIGATION"], expectedKeywords: ["dang", "nhap", "tai", "khoan"], difficulty: "easy", domain: "navigation" },
  { id: "g037", query: "Xem gio hang", expectedCategories: ["NAVIGATION"], expectedKeywords: ["gio", "hang"], difficulty: "easy", domain: "navigation" },
  { id: "g038", query: "Them san pham moi", expectedCategories: ["NAVIGATION"], expectedKeywords: ["them", "san", "pham"], difficulty: "easy", domain: "navigation" },
  { id: "g039", query: "Gia vang hom nay", expectedCategories: ["MARKET_PRICE"], expectedKeywords: ["gia", "vang"], difficulty: "easy", domain: "market_price" },
  { id: "g040", query: "Ty gia ngoai te", expectedCategories: ["FINANCE_COST"], expectedKeywords: ["ty", "gia", "ngoai", "te"], difficulty: "easy", domain: "finance" },
  // === More agriculture queries ===
  { id: "g041", query: "Trong rau sach trong nha luoi", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["trong", "rau", "sach", "nha", "luoi"], difficulty: "easy", domain: "agriculture" },
  { id: "g042", query: "Nuoi tom cong nghe cao", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["nuoi", "tom", "cong", "nghe", "cao"], difficulty: "easy", domain: "aquaculture" },
  { id: "g043", query: "Cham soc cay an qua sau mua vu", expectedCategories: ["SMART_AGRI", "AGRI_SEASON"], expectedKeywords: ["cham", "soc", "cay", "an", "qua"], difficulty: "easy", domain: "agriculture" },
  { id: "g044", query: "Benh heo xanh tren cay ot", expectedCategories: ["SMART_AGRI", "AGRI_PEST"], expectedKeywords: ["benh", "heo", "xanh", "ot"], difficulty: "easy", domain: "agriculture" },
  { id: "g045", query: "Gia thit heo thi truong", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "thit", "heo", "thi", "truong"], difficulty: "easy", domain: "market_price" },
  // === More medium queries ===
  { id: "g046", query: "Lam the nao de tiet kiem chi phi phan bon?", expectedCategories: ["FINANCE_COST", "AGRI_FERTILIZER"], expectedKeywords: ["tiet", "kiem", "chi", "phi", "phan", "bon"], difficulty: "medium", domain: "finance" },
  { id: "g047", query: "Xay dung thuong hieu nong san Viet", expectedCategories: ["MARKET_PRICE", "AGRI_MARKETING"], expectedKeywords: ["xay", "dung", "thuong", "hieu", "nong", "san"], difficulty: "medium", domain: "marketing" },
  { id: "g048", query: "Ung dung AI trong phan tich benh cay trong", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["ai", "phan", "tich", "benh", "cay"], difficulty: "medium", domain: "technology" },
  { id: "g049", query: "Quan ly tai chinh trang trai", expectedCategories: ["FINANCE_COST"], expectedKeywords: ["quan", "ly", "tai", "chinh", "trang", "trai"], difficulty: "medium", domain: "finance" },
  { id: "g050", query: "Dao tao nhan luc nong nghiep cong nghe cao", expectedCategories: ["SMART_AGRI", "AGRI_EDUCATION"], expectedKeywords: ["dao", "tao", "nhan", "luc", "nong", "nghiep"], difficulty: "medium", domain: "education" },
  // === Hard queries ===
  { id: "g051", query: "Phan tich chuoi cung ung tu ruong dong den ban an cua sieu thi va cac yeu to anh huong den gia thanh cuoi cung", expectedCategories: ["FINANCE_COST", "NAVIGATION"], expectedKeywords: ["phan", "tich", "chuoi", "cung", "ung", "gia", "thanh"], difficulty: "hard", domain: "logistics" },
  { id: "g052", query: "So sanh hieu qua giua he thong tuoi nho giong va tuoi phun cho vung dat han han", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["so", "sanh", "tuoi", "nho", "giong", "phun", "han", "han"], difficulty: "hard", domain: "agriculture" },
  { id: "g053", query: "Toi muon biet gia ca phe va lua cung luc de quyet dinh trong loai nao", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "ca phe", "lua", "trong"], difficulty: "hard", domain: "market_price" },
  { id: "g054", query: "Du bao san luong nong nghiep dua tren du lieu thoi tiet va lich su canh tac", expectedCategories: ["WEATHER_SEASON", "AGRI_YIELD"], expectedKeywords: ["du", "bao", "san", "luong", "thoi", "tiet"], difficulty: "hard", domain: "forecast" },
  { id: "g055", query: "Phan tich ROI khi dau tu he thong IoT cho trang trai 5 hecta", expectedCategories: ["FINANCE_COST", "AGRI_IOT"], expectedKeywords: ["roi", "dau", "tu", "iot", "trang", "trai"], difficulty: "hard", domain: "finance" },
  // === Vietnamese shorthand queries ===
  { id: "g056", query: "gia lua hom nay", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["gia", "lua"], difficulty: "easy", domain: "market_price" },
  { id: "g057", query: "cach trong lua", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["cach", "trong", "lua"], difficulty: "easy", domain: "agriculture" },
  { id: "g058", query: "sau benh lua", expectedCategories: ["SMART_AGRI", "AGRI_PEST"], expectedKeywords: ["sau", "benh", "lua"], difficulty: "easy", domain: "agriculture" },
  { id: "g059", query: "phan bon cho lua", expectedCategories: ["SMART_AGRI", "AGRI_FERTILIZER"], expectedKeywords: ["phan", "bon", "lua"], difficulty: "easy", domain: "agriculture" },
  { id: "g060", query: "tuoi tu dong", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["tuoi", "tu", "dong"], difficulty: "easy", domain: "technology" },
  // === English queries ===
  { id: "g061", query: "What is the price of rice today?", expectedCategories: ["MARKET_PRICE", "AGRI_PRICE"], expectedKeywords: ["price", "rice", "today"], difficulty: "easy", domain: "market_price" },
  { id: "g062", query: "How to grow coffee in Vietnam?", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["grow", "coffee", "vietnam"], difficulty: "easy", domain: "agriculture" },
  { id: "g063", query: "Smart irrigation system for rice fields", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["irrigation", "system", "rice", "field"], difficulty: "easy", domain: "technology" },
  { id: "g064", query: "Weather forecast for farming this week", expectedCategories: ["WEATHER_SEASON"], expectedKeywords: ["weather", "forecast", "farming"], difficulty: "easy", domain: "weather" },
  { id: "g065", query: "Cost analysis for 1 hectare rice production", expectedCategories: ["FINANCE_COST", "AGRI_COST"], expectedKeywords: ["cost", "analysis", "hectare", "rice"], difficulty: "medium", domain: "finance" },
  // === Edge cases ===
  { id: "g066", query: "Xin chao", expectedCategories: ["GENERAL"], expectedKeywords: ["xin", "chao"], difficulty: "easy", domain: "greeting" },
  { id: "g067", query: "Ban co the giup gi cho toi?", expectedCategories: ["GENERAL"], expectedKeywords: ["giup", "gi"], difficulty: "easy", domain: "general" },
  { id: "g068", query: "Cam on", expectedCategories: ["GENERAL"], expectedKeywords: ["cam", "on"], difficulty: "easy", domain: "greeting" },
  { id: "g069", query: "Tam biet", expectedCategories: ["GENERAL"], expectedKeywords: ["tam", "biet"], difficulty: "easy", domain: "greeting" },
  { id: "g070", query: "Help me", expectedCategories: ["GENERAL"], expectedKeywords: ["help"], difficulty: "easy", domain: "general" },
  // === More specific agriculture queries ===
  { id: "g071", query: "Bon phan cho lua giai doan dong pha", expectedCategories: ["SMART_AGRI", "AGRI_FERTILIZER"], expectedKeywords: ["bon", "phan", "lua", "dong", "pha"], difficulty: "medium", domain: "agriculture" },
  { id: "g072", query: "Phong benh dao on co bong tren lua", expectedCategories: ["SMART_AGRI", "AGRI_PEST"], expectedKeywords: ["phong", "benh", "dao", "on", "co", "bong"], difficulty: "medium", domain: "agriculture" },
  { id: "g073", query: "Ky thuat gieo sa lua mat do cao", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["ky", "thuat", "gieo", "sa", "lua", "mat", "do"], difficulty: "medium", domain: "agriculture" },
  { id: "g074", query: "Xu ly dat phen truoc khi trong lua", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["xu", "ly", "dat", "phen", "trong", "lua"], difficulty: "medium", domain: "agriculture" },
  { id: "g075", query: "Thu hoach lua bang may gat dap lien hop", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["thu", "hoach", "lua", "may", "gat"], difficulty: "medium", domain: "agriculture" },
  // === Financial queries ===
  { id: "g076", query: "Vay von ngan hang cho nong nghiep", expectedCategories: ["FINANCE_COST"], expectedKeywords: ["vay", "von", "ngan", "hang", "nong", "nghiep"], difficulty: "easy", domain: "finance" },
  { id: "g077", query: "Bao hiem mua mang", expectedCategories: ["FINANCE_COST", "AGRI_SEASON"], expectedKeywords: ["bao", "hiem", "mua", "mang"], difficulty: "easy", domain: "finance" },
  { id: "g078", query: "Tinh toan loi nhuan trong ca phe", expectedCategories: ["FINANCE_COST", "AGRI_COST"], expectedKeywords: ["tinh", "toan", "loi", "nhuan", "trong", "ca", "phe"], difficulty: "medium", domain: "finance" },
  { id: "g079", query: "Chi phi van chuyen nong san tu vuon ra cho", expectedCategories: ["FINANCE_COST", "NAVIGATION"], expectedKeywords: ["chi", "phi", "van", "chuyen", "nong", "san"], difficulty: "medium", domain: "logistics" },
  { id: "g080", query: "Gia phan bon hien tai tren thi truong", expectedCategories: ["MARKET_PRICE", "AGRI_FERTILIZER"], expectedKeywords: ["gia", "phan", "bon", "thi", "truong"], difficulty: "easy", domain: "market_price" },
  // === Weather queries ===
  { id: "g081", query: "Du bao thoi tiet cho vu dong xuan", expectedCategories: ["WEATHER_SEASON", "AGRI_SEASON"], expectedKeywords: ["du", "bao", "thoi", "tiet", "dong", "xuan"], difficulty: "easy", domain: "weather" },
  { id: "g082", query: "Mua lu anh huong den mua mang", expectedCategories: ["WEATHER_SEASON", "AGRI_SEASON"], expectedKeywords: ["mua", "lu", "anh", "huong", "mua", "mang"], difficulty: "easy", domain: "weather" },
  { id: "g083", query: "Nhiet do ly tuong cho trong lua", expectedCategories: ["WEATHER_SEASON", "AGRI_SEASON"], expectedKeywords: ["nhiet", "do", "trong", "lua"], difficulty: "easy", domain: "weather" },
  { id: "g084", query: "Du bao mua cho vung Dong bang song Cuu Long", expectedCategories: ["WEATHER_SEASON"], expectedKeywords: ["du", "bao", "mua", "dong", "bang"], difficulty: "easy", domain: "weather" },
  { id: "g085", query: "Thoi tiet hom nay", expectedCategories: ["WEATHER_SEASON"], expectedKeywords: ["thoi", "tiet", "hom", "nay"], difficulty: "easy", domain: "weather" },
  // === More medium-hard queries ===
  { id: "g086", query: "Xay dung mo hinh nong nghiep thong minh voi chi phi thap", expectedCategories: ["SMART_AGRI", "AGRI_TECHNOLOGY"], expectedKeywords: ["xay", "dung", "mo", "hinh", "nong", "nghiep", "thong", "minh", "chi", "phi"], difficulty: "hard", domain: "technology" },
  { id: "g087", query: "So sanh nang suat giua lua OM5451 va lua Jasmine", expectedCategories: ["SMART_AGRI", "AGRI_YIELD"], expectedKeywords: ["so", "sanh", "nang", "suat", "lua"], difficulty: "hard", domain: "agriculture" },
  { id: "g088", query: "Phan tich chuoi gia tri nong san tu san xuat den tieu dung", expectedCategories: ["FINANCE_COST", "NAVIGATION"], expectedKeywords: ["phan", "tich", "chuoi", "gia", "tri", "nong", "san"], difficulty: "hard", domain: "logistics" },
  { id: "g089", query: "Ung dung machine learning du bao gia nong san", expectedCategories: ["MARKET_PRICE", "AGRI_TECHNOLOGY"], expectedKeywords: ["machine", "learning", "du", "bao", "gia"], difficulty: "hard", domain: "technology" },
  { id: "g090", query: "Toi uu hoa quy trinh san xuat nong nghiep tu giong den thu hoach", expectedCategories: ["SMART_AGRI", "AGRI_TECHNIQUE"], expectedKeywords: ["toi", "uu", "quy", "trinh", "san", "xuat"], difficulty: "hard", domain: "agriculture" },
  // === Product/order queries ===
  { id: "g091", query: "Xem danh sach san pham", expectedCategories: ["NAVIGATION"], expectedKeywords: ["danh", "sach", "san", "pham"], difficulty: "easy", domain: "navigation" },
  { id: "g092", query: "Tim kiem san pham nong nghiep", expectedCategories: ["NAVIGATION", "SMART_AGRI"], expectedKeywords: ["tim", "kiem", "san", "pham", "nong"], difficulty: "easy", domain: "navigation" },
  { id: "g093", query: "Danh gia san pham", expectedCategories: ["NAVIGATION"], expectedKeywords: ["danh", "gia", "san", "pham"], difficulty: "easy", domain: "navigation" },
  { id: "g094", query: "Theo doi don hang", expectedCategories: ["NAVIGATION", "ORDER_PAYMENT"], expectedKeywords: ["theo", "doi", "don", "hang"], difficulty: "easy", domain: "order" },
  { id: "g095", query: "Thanh toan don hang", expectedCategories: ["ORDER_PAYMENT"], expectedKeywords: ["than", "toan", "don", "hang"], difficulty: "easy", domain: "order" },
  // === Final queries ===
  { id: "g096", query: "Cap nhat thong tin tai khoan", expectedCategories: ["NAVIGATION"], expectedKeywords: ["cap", "nhat", "thong", "tin", "tai", "khoan"], difficulty: "easy", domain: "navigation" },
  { id: "g097", query: "Xem bao cao doanh thu", expectedCategories: ["NAVIGATION", "FINANCE_COST"], expectedKeywords: ["xem", "bao", "cao", "doanh", "thu"], difficulty: "easy", domain: "navigation" },
  { id: "g098", query: "Quan ly kho hang", expectedCategories: ["NAVIGATION"], expectedKeywords: ["quan", "ly", "kho", "hang"], difficulty: "easy", domain: "navigation" },
  { id: "g099", query: "Xuat bao cao nong san", expectedCategories: ["NAVIGATION", "SMART_AGRI"], expectedKeywords: ["xuat", "bao", "cao", "nong", "san"], difficulty: "easy", domain: "navigation" },
  { id: "g100", query: "Cai dat he thong", expectedCategories: ["NAVIGATION"], expectedKeywords: ["cai", "dat", "he", "thong"], difficulty: "easy", domain: "navigation" },
  // === Bonus: Very hard multi-hop queries ===
  { id: "g101", query: "Neu thoi tiet mua keo dai thi gia lua se tang hay giam va toi nen lam gi?", expectedCategories: ["WEATHER_SEASON", "MARKET_PRICE", "AGRI_SEASON"], expectedKeywords: ["thoi", "tiet", "mua", "gia", "lua", "tang", "giam"], difficulty: "hard", domain: "multi_hop" },
  { id: "g102", query: "So sanh chi phi san xuat lua giua Viet Nam va Thai Lan", expectedCategories: ["FINANCE_COST", "AGRI_COST"], expectedKeywords: ["chi", "phi", "san", "xuat", "lua", "viet", "nam", "thai", "lan"], difficulty: "hard", domain: "finance" },
  { id: "g103", query: "He thong IoT nao phu hop cho trang trai cao su Tay Nguyen?", expectedCategories: ["SMART_AGRI", "AGRI_IOT"], expectedKeywords: ["iot", "trang", "trai", "cao", "su", "tay", "nguyen"], difficulty: "hard", domain: "technology" },
  { id: "g104", query: "Phan tich tac dong cua El Nino den san luong ca phe Viet Nam", expectedCategories: ["WEATHER_SEASON", "AGRI_YIELD"], expectedKeywords: ["el", "nino", "san", "luong", "ca", "phe"], difficulty: "hard", domain: "climate" },
  { id: "g105", query: "Xay dung chuoi cung ung lanh cho nong san tuoi tu ruong den sieu thi", expectedCategories: ["NAVIGATION", "AGRI_LOGISTICS"], expectedKeywords: ["chuoi", "cung", "ung", "lanh", "nong", "san"], difficulty: "hard", domain: "logistics" },
];
