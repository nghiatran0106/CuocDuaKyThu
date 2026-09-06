# Chơi cùng bạn qua mạng

`src/multiplayer.ts` triển khai phòng WebRTC thật cho tối đa 4 trình duyệt. Người tạo phòng chia sẻ mã 6 ký tự; các bạn nhập mã rồi chờ chủ phòng bắt đầu. Không có người chơi giả thay cho kết nối mạng.

Ứng dụng web có thể được triển khai trên hosting tĩnh HTTPS. PeerJS dùng dịch vụ công khai mặc định để tìm peer và trao đổi thông tin thiết lập kết nối. Sau đó dữ liệu game đi qua các DataConnection đáng tin cậy giữa các trình duyệt. Xem [hướng dẫn PeerJS](https://peerjs.com/client/getting-started) và [API kết nối](https://peerjs.com/client/api/peer).

## Giao thức

- ID phòng: `turbo-buddies-v1-` + mã phòng. Mã dùng `crypto.getRandomValues`; việc trùng mã được thử lại tối đa 4 lần trong giới hạn kết nối 12 giây.
- Chủ phòng quyết định danh sách thành viên, số lượng người chơi, thời điểm xuất phát và chuyển tiếp trạng thái. Máy khách chỉ được cập nhật xe gắn với kết nối của mình. Mỗi trình duyệt mô phỏng vật lý xe của chính mình; đây không phải máy chủ vật lý hoặc hệ thống chống gian lận.
- Chủ phòng gửi thời điểm xuất phát sau 5 giây. Máy khách đo lệch đồng hồ qua ping/pong và chuyển thời điểm này sang đồng hồ cục bộ.
- Trạng thái gồm tổng số vòng dạng số thực `progress` (0–3), vị trí ngang kể cả lề đường `lane` (-1,65–1,65), `speed` (0–3200 đơn vị thế giới/giây), `finished` và thời gian đua `time` tính bằng giây. Bên gọi giới hạn tần suất gửi trạng thái; phía nhận thêm giới hạn tối đa 40 cập nhật/giây mỗi người chơi.
- Sáu ID vật phẩm: `nitro`, `shield`, `rocket`, `magnet`, `banana`, `lightning`. Sự kiện `powerup` chứa `id` vật phẩm và `from` người dùng. Chủ phòng chọn mục tiêu `target` cho rocket (người gần nhất phía trước) và banana (người gần nhất phía sau) từ danh sách trạng thái; mục tiêu rỗng nghĩa là không trúng ai. Sấm sét áp dụng cho mọi đối thủ, trừ người dùng vật phẩm. Người đã về đích không được chọn làm mục tiêu. Máy khách không tự chọn mục tiêu. Chủ phòng giới hạn ít nhất 500 ms giữa hai lần dùng vật phẩm của cùng một người.
- Dữ liệu đầu vào được kiểm tra phiên bản giao thức, kiểu, phạm vi số, danh sách thành viên và độ dài chuỗi. Tên được bỏ ký tự điều khiển và giới hạn 20 ký tự; giao diện phải hiển thị tên như văn bản, không chèn trực tiếp thành HTML.
- Phòng từ chối người vào sau khi bắt đầu hoặc khi đã đủ 4 người. Mất máy khách cập nhật danh sách; mất chủ phòng đóng phiên. Không có chuyển quyền chủ phòng tự động. Ping mỗi 2 giây phát hiện mất kết nối trong khoảng 12–14 giây.
- `leave()` đóng DataConnection, hủy timer/heartbeat, hủy yêu cầu đang chờ và giải phóng Peer. Gói từ phiên cũ không được tác động vào phiên mới.

## Giới hạn triển khai

Không cấu hình TURN riêng hoặc thông tin đăng nhập TURN. WebRTC có thể không kết nối được qua một số NAT, mạng công ty, VPN hoặc firewall. Dịch vụ signaling công khai cũng có thể gián đoạn; mã nguồn báo lỗi hoặc hết thời gian kết nối, không báo kết nối thành công giả. Muốn hỗ trợ mạng hạn chế ổn định hơn cần PeerServer do mình vận hành và TURN với thông tin đăng nhập ngắn hạn. Xem [FAQ chính thức về NAT/TURN](https://peerjs.com/client/faq).

Mã phòng là lời mời chia sẻ, không phải cơ chế xác thực tài khoản. Phòng chỉ tồn tại trong khi tab của chủ phòng còn hoạt động. Các trình duyệt có thể hạn chế timer khi tab bị đưa xuống nền, nên người chơi cần giữ tab game đang mở khi đua.

## Kiểm tra

Đã chạy ngày 06/09/2026:

- `npx tsc --noEmit`: đạt.
- Chromium headless qua Playwright, 5 browser context độc lập, gọi dịch vụ PeerJS công khai thật và dùng DataConnection WebRTC thật: tạo phòng, 4 người vào phòng, người thứ 5 bị từ chối; chỉ chủ phòng có thể bắt đầu; máy khách có đồng hồ lệch +2 phút nhận thời điểm bắt đầu được bù chính xác.
- Trao đổi trạng thái hai chiều (kể cả xe ngoài lề và tốc độ nitro), từ chối gói trạng thái ngoài phạm vi, chuyển tiếp rocket, cập nhật khi khách rời, từ chối vào phòng đang đua, đóng phòng và dọn trạng thái khi chủ phòng rời: đạt.
- Ép lần tạo đầu trùng ID một phòng thật để kiểm tra sinh lại mã: đạt. Mã không đủ 6 ký tự, phòng không tồn tại, hủy yêu cầu tham gia, tham gia lại sau khi hủy: đạt.
- Nhánh hết thời gian kết nối được kiểm tra với timer 12 giây được rút ngắn trong browser kiểm thử: trả lỗi và dọn phiên đúng.
- Kiểm thử giao diện bằng Playwright trên bản production preview: hai browser context tạo/vào cùng phòng qua PeerJS thật, chọn đường đua của chủ phòng, xuất phát đồng bộ, nhìn thấy tên đối thủ được vẽ thật trên Canvas; giữ phanh ở máy khách khiến máy khách tụt lại. Máy khách nhặt hộp vật phẩm thật, dùng rocket và chỉ chủ phòng phía trước nhận đòn; người bắn không tự trúng đòn. Chủ phòng rời thì cả hai màn hình đua đóng và khách có thể mở lại cửa sổ tạo phòng. Kịch bản này đạt, không bị bỏ qua do mạng.

Các kịch bản kiểm tra giao thức chạy từ script tạm trong `/tmp/turbo-multiplayer-real.cjs` và `/tmp/turbo-multiplayer-edges.cjs`; chúng không được đóng gói vào sản phẩm. Đây là kiểm tra nhiều browser context trên cùng máy, chưa phải kiểm tra hai thiết bị qua hai mạng/NAT khác nhau. Cần thực hiện kiểm tra đó trước khi vận hành với yêu cầu độ sẵn sàng.

Các bài kiểm tra giao diện được lưu trong `tests/`. Chạy `npm test` để Playwright tự khởi động hoặc dùng lại Vite tại cổng 5173. Khi kiểm tra bản build đang chạy bằng `npm run preview -- --port 4173`, dùng `E2E_BASE_URL=http://127.0.0.1:4173 npm test` để tránh Vite tự tải lại trang khi đang chỉnh mã nguồn. Kiểm tra nhiều người chỉ được bỏ qua khi có bằng chứng dịch vụ PeerJS/WebRTC bên ngoài không kết nối được; các lỗi giao diện không được chuyển thành kết quả bỏ qua.

Bộ kiểm tra còn xác minh cutscene, nhặt/dùng vật phẩm, tạm dừng/tiếp tục, phanh cảm ứng, xử lý dữ liệu lưu lỗi và lưu thành tích sau khi thật sự hoàn thành 3 vòng. Bài kiểm tra hoàn thành cuộc đua chạy đồng hồ ảo qua vật lý game, giữ một số khung hình Canvas đại diện và bỏ qua phần lớn lệnh tô pixel để giảm thời gian trên máy render bằng CPU; không phát sự kiện về đích giả hoặc sửa trạng thái vật lý riêng tư. Bài kiểm tra gameplay riêng vẫn vẽ toàn bộ khung hình.
