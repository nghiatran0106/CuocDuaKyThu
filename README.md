# Turbo Buddies — Cuộc đua kỳ thú

Game đua xe hoạt hình chạy trực tiếp trên web, viết bằng TypeScript, Canvas 2D và Vite. Đồ họa SVG, nhân vật và âm thanh đều được tạo trong dự án; không cần tải tài nguyên game từ dịch vụ khác.

## Chơi game

- **Đua với máy:** chọn 1 trong 4 nhân vật, 1 trong 3 đường đua, rồi nhấn **Đua ngay**. Có 3 đối thủ AI và 3 vòng đua.
- **Đua cùng bạn bè:** nhấn **Rủ bạn cùng đua**, tạo phòng, gửi mã hoặc liên kết. Hỗ trợ 2–4 người, chủ phòng chọn đường đua và bắt đầu.
- Xe tự tăng ga. **← / →** hoặc **A / D** để rẽ, **↓ / S** để phanh, **Shift + rẽ** để drift và thả Shift để nhận mini turbo. **Space** kích hoạt vật phẩm. **Esc** tạm dừng khi đua với máy.
- Điện thoại có nút rẽ, phanh, drift và dùng vật phẩm trên màn hình.
- Nhặt xu và hộp bí ẩn. Sáu power-up: nitro, khiên, rocket, nam châm, chuối và sấm sét.
- Có cutscene giới thiệu đường đua, đếm ngược, popup khi nhặt/dùng vật phẩm, hiệu ứng tăng tốc, màn hình về đích và huy hiệu.
- Tên, lựa chọn, xu, kết quả và huy hiệu được lưu trong `localStorage` của trình duyệt.

## Chạy và build

Cần Node.js 22.12 trở lên.

```bash
npm ci
npm run dev
npm run build
npm run preview
```

Build được kiểm tra TypeScript rồi xuất ra `dist/`. Đây là website tĩnh, có thể phục vụ bằng bất kỳ hosting HTTPS nào. Cấu hình Sites nằm trong `.openai/hosting.json`; không chứa khóa bí mật.

## Kiểm thử

```bash
npx playwright install chromium
npm test
```

Các kiểm thử trình duyệt xác nhận điều khiển, đếm ngược, nhặt và dùng power-up, tạm dừng, hoàn thành 3 vòng, lưu thành tích, điều khiển cảm ứng và kết nối hai người chơi thực qua WebRTC. Các kiểm thử phòng chơi cần truy cập dịch vụ báo hiệu PeerJS công cộng. Xem thêm `NETWORK.md`.

## Cấu trúc

- `src/main.ts`: sảnh đua, chọn nhân vật/đường đua, phòng chơi, HUD và kết quả.
- `src/game/engine.ts`: đường đua giả lập phối cảnh 3D, vật lý, đối thủ, drift, vật phẩm và đồng bộ trạng thái người chơi.
- `src/game/audio.ts`: âm thanh sinh bằng Web Audio API.
- `src/multiplayer.ts`: PeerJS/WebRTC, mã phòng, danh sách tay đua, đồng bộ thời điểm xuất phát và chuyển tiếp trạng thái.
- `src/art.ts`: bộ SVG gốc cho nhân vật, đường đua, hero và power-up.
- `src/data.ts`: dữ liệu nhân vật/đường đua và thành tích trên thiết bị.
- `src/style.css`: giao diện responsive cho máy tính và điện thoại.

## Phạm vi multiplayer

Đây là multiplayer P2P dành cho nhóm bạn: mỗi máy mô phỏng xe của mình, chủ phòng chuyển tiếp trạng thái. Giữ tab chủ phòng mở trong suốt cuộc đua. Mạng chặn WebRTC hoặc NAT quá chặt có thể cần dịch vụ TURN riêng. Phiên bản hiện tại chưa có tài khoản, bảng xếp hạng toàn cầu, máy chủ vật lý chống gian lận hoặc tự chuyển chủ phòng. Khi mở menu trong trận nhiều người, cuộc đua vẫn tiếp tục.
