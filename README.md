# Turbo Buddies — Cuộc đua kỳ thú

Chơi bản public tại **https://nghiatran0106.github.io/CuocDuaKyThu/** — không cần đăng nhập ChatGPT.

Game đua xe hoạt hình chạy trực tiếp trên web, viết bằng TypeScript, Canvas 2D và Vite. Đồ họa SVG, nhân vật và âm thanh đều được tạo trong dự án; không cần tải tài nguyên game từ dịch vụ khác.

## Chơi game

- **Đua với máy:** chọn 1 trong 4 nhân vật, 1 trong 3 đường đua, rồi nhấn **Đua ngay**. Có 3 đối thủ AI và 3 vòng đua.
- **Đua cùng bạn bè:** nhấn **Rủ bạn cùng đua**, tạo phòng, gửi mã hoặc liên kết. Hỗ trợ 2–4 người, chủ phòng chọn đường đua và bắt đầu.
- Xe tự tăng ga. **← / →** hoặc **A / D** để rẽ, **↓ / S** để phanh trước cua gấp, **Shift + rẽ theo hướng cua** để tích drift và thả Shift khi còn trên đường để nhận mini turbo. Drift trên đường thẳng, ngược hướng cua hoặc ra lề không tích turbo. **Space** kích hoạt vật phẩm. **Esc** tạm dừng khi đua với máy.
- Ba lộ trình riêng có cua tay áo, chữ S, chicane, đoạn hẹp và dốc. Vào cua quá nhanh sẽ trượt ra ngoài; chạy ra lề làm mất tốc độ. Mini map hiển thị lộ trình, vạch đích và vị trí mọi tay đua; HUD báo hướng cua và tốc độ vào cua đề xuất.
- NPC chọn đường ôm cua, phanh trước góc gấp, tìm làn vượt và dùng mini turbo khi thoát cua. Ba độ khó thay đổi tốc độ và khả năng xử lý cua; NPC cùng chịu vật lý bám đường và mất tốc khi ra lề như người chơi.
- Điện thoại có nút rẽ, phanh, drift và dùng vật phẩm trên màn hình.
- Mỗi vòng chỉ có **3 hộp vật phẩm đơn** và **1 vùng tăng tốc** ở đoạn thẳng; các dải xu ngắn gợi ý đường ôm cua. Sáu power-up: nitro, khiên, rocket, nam châm, chuối và sấm sét.
- Có cutscene giới thiệu đường đua, đếm ngược, popup khi nhặt/dùng vật phẩm, hiệu ứng tăng tốc, màn hình về đích và huy hiệu.
- Tên, lựa chọn, xu, kết quả và huy hiệu được lưu trong `localStorage` của trình duyệt.

## Cài trên điện thoại

Game hỗ trợ **PWA**: thêm biểu tượng vào màn hình chính và mở game như một ứng dụng web. Mở liên kết game bằng trình duyệt trên điện thoại rồi làm theo hướng dẫn:

- **Android / Chrome:** dùng nút cài đặt trong sảnh khi trình duyệt hỗ trợ, hoặc mở menu **⋮ → Thêm vào màn hình chính → Cài đặt**. Tên mục có thể khác giữa các trình duyệt. [Hướng dẫn Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=vi).
- **iPhone / Safari:** chọn **Chia sẻ → Thêm vào Màn hình chính → Thêm**; bật **Mở dưới dạng ứng dụng web** nếu tùy chọn này xuất hiện. [Hướng dẫn Apple](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

Sau lần tải trực tuyến thành công và lưu game vào bộ nhớ đệm, bạn có thể mở lại để **đua với máy khi mất mạng**. **Đua cùng bạn bè vẫn cần Internet** để tạo phòng và kết nối các tay đua. Trình duyệt có thể xóa bộ nhớ đệm khi dọn dữ liệu hoặc thiếu dung lượng; khi đó cần mở game có mạng một lần nữa.

Khi có phiên bản mới, sảnh hiển thị tùy chọn cập nhật. Bạn chủ động áp dụng cập nhật từ sảnh; game không tự tải lại giữa cuộc đua. Việc hiện lời mời cài đặt và cách mở ứng dụng phụ thuộc trình duyệt, phiên bản hệ điều hành và chế độ duyệt web.

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
npm run test:pwa
```

Các kiểm thử trình duyệt xác nhận điều khiển, đếm ngược, nhặt và dùng power-up, tạm dừng, hoàn thành 3 vòng, lưu thành tích, điều khiển cảm ứng và kết nối hai người chơi thực qua WebRTC. Các kiểm thử phòng chơi cần truy cập dịch vụ báo hiệu PeerJS công cộng. Xem thêm `NETWORK.md`.

`npm run test:pwa` kiểm tra bản build production, gồm manifest, biểu tượng cài đặt, tải game khi mất mạng và luồng cập nhật. Các file PNG trong `public/icons/` được xuất từ biểu tượng SVG gốc của dự án. Để tạo lại sau khi sửa SVG, dùng `node scripts/generate-icons.mjs`; máy tạo ảnh cần lệnh `rsvg-convert` của librsvg. Các biểu tượng PNG đã được lưu trong dự án nên build thông thường không cần công cụ này.

## Cấu trúc

- `src/main.ts`: sảnh đua, chọn nhân vật/đường đua, phòng chơi, HUD và kết quả.
- `src/game/engine.ts`: đường đua giả lập phối cảnh 3D, vật lý, đối thủ, drift, vật phẩm và đồng bộ trạng thái người chơi.
- `src/game/circuit.ts`: hình học chung cho ba lộ trình, mini map và vị trí vật phẩm.
- `src/game/driving.ts`: xử lý bám đường, phanh, drift và ra lề cho người chơi lẫn NPC.
- `src/game/minimap.ts`: vẽ bản đồ và cập nhật vị trí các tay đua.
- `src/game/audio.ts`: âm thanh sinh bằng Web Audio API.
- `src/multiplayer.ts`: PeerJS/WebRTC, mã phòng, danh sách tay đua, đồng bộ thời điểm xuất phát và chuyển tiếp trạng thái.
- `src/art.ts`: bộ SVG gốc cho nhân vật, đường đua, hero và power-up.
- `src/data.ts`: dữ liệu nhân vật/đường đua và thành tích trên thiết bị.
- `src/style.css`: giao diện responsive cho máy tính và điện thoại.
- `public/icons/`: biểu tượng SVG gốc và PNG cho PWA, biểu tượng maskable và màn hình chính iPhone.

## Phạm vi multiplayer

Đây là multiplayer P2P dành cho nhóm bạn: mỗi máy mô phỏng xe của mình, chủ phòng chuyển tiếp trạng thái. Giữ tab chủ phòng mở trong suốt cuộc đua. Mạng chặn WebRTC hoặc NAT quá chặt có thể cần dịch vụ TURN riêng. Phiên bản hiện tại chưa có tài khoản, bảng xếp hạng toàn cầu, máy chủ vật lý chống gian lận hoặc tự chuyển chủ phòng. Khi mở menu trong trận nhiều người, cuộc đua vẫn tiếp tục.
