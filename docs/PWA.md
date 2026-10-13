# Ghi chú về PWA và hướng màn hình

**Hiện trạng:** chưa có web app manifest, chưa có service worker. Trang chỉ có icon SVG nội tuyến (`index.html`), để trình duyệt không xin `/favicon.ico` và nhận 404.

## Hướng màn hình hiện tại

Game được thiết kế cho ngang. Trên thiết bị cảm ứng cầm dọc, `OrientationGate` hiện màn "Xoay ngang thiết bị để chơi", chặn chạm và khoá gameplay (D-024). Đây là cơ chế trong ứng dụng, không cần manifest.

## Nếu thêm manifest sau này

Cần làm đủ các mục sau, không thì chỉ được một nửa:

1. Tệp `manifest.webmanifest` với `name`, `short_name`, `start_url`, `display: "standalone"`, `orientation: "landscape"`, `background_color`, `theme_color`.
2. Icon PNG ở ít nhất 192 px và 512 px. Icon SVG nội tuyến chỉ dùng cho favicon, không đủ cho manifest. Nên đặt icon thành tệp thật trong `public/` thay vì data URI, vì chưa kiểm chứng trình duyệt nào chấp nhận data URI trong manifest.
3. Thử cài đặt trên Android Chrome. Kiểm tra khoá hướng có thật không, và OrientationGate vẫn chạy nếu trình duyệt bỏ qua khoá.
4. Service worker chỉ khi có nhu cầu chơi ngoại tuyến. Nó phải dùng phiên bản rõ ràng, để bản cũ không giữ tiến trình sai định dạng.

Không thêm manifest chỉ để có icon. Icon hiện tại đủ cho tab trình duyệt.
