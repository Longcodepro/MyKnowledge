# Kho tri thức HTML

Bỏ file `.html` vào `content/`, trang chủ tự liệt kê tất cả. Triển khai lên Vercel để xem ở đâu cũng được.

## ⚠️ Cảnh báo công khai

Link Vercel production là **CÔNG KHAI với bất kỳ ai có link**. Đừng bỏ vào đây file chứa mật khẩu, khoá API, hay mã nguồn bài tập chưa muốn công khai. (Trang đã gửi header `noindex` để Google không lập chỉ mục, nhưng ai có link vẫn mở được.)

## Thêm file

- Chép file `.html` vào `content/`. Có thể tạo thư mục con (mỗi thư mục thành một nhóm trên trang chủ). Tên có dấu và khoảng trắng đều được.
- Ảnh, css, js đi kèm cứ để cạnh file html, sẽ được chép sang nguyên cấu trúc.
- File/thư mục bắt đầu bằng `.` hoặc `_` (ví dụ `content/_nhap/`) bị bỏ qua: không liệt kê và không được đưa lên web. Vì vậy đừng để ảnh/css cần dùng trong thư mục bắt đầu bằng `_`.

## Build thử trên máy

```bash
npm run build
npx serve dist
```

- `npm run build`: chạy script trong `package.json`, tức `node scripts/build.mjs`, dựng thư mục `dist/` và in số file tìm thấy.
- `npx serve dist`: tải (lần đầu) và chạy tạm công cụ `serve` để mở thư mục `dist` thành web cục bộ; mở link nó in ra (thường `http://localhost:3000`). Nhấn `Ctrl+C` để tắt.

## Triển khai lên Vercel

**Cách A (dễ nhất):** vào [vercel.com](https://vercel.com) → Add New → Project → chọn repo GitHub này → Deploy. Vercel tự đọc `vercel.json`. Từ đó mỗi lần `git push` là web tự cập nhật.

**Cách B (dòng lệnh):**

```bash
npx vercel
npx vercel --prod
```

- `npx vercel`: chạy công cụ Vercel mà không cần cài; lần đầu sẽ hỏi đăng nhập và đặt tên project. Lệnh này tạo bản **xem thử** (preview).
- `npx vercel --prod`: cùng việc đó nhưng đưa lên link **chính thức** (production). `--prod` là cờ chọn môi trường production.

## Đẩy thay đổi lên GitHub (cho Cách A)

```bash
git add .
git commit -m "Thêm bài mới"
git push
```

- `git add .`: đánh dấu mọi thay đổi trong thư mục hiện tại để chuẩn bị lưu.
- `git commit -m "..."`: lưu các thay đổi đó thành một mốc, `-m` là lời ghi chú.
- `git push`: gửi các mốc lên GitHub.
