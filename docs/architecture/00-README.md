# SignLearn — Architecture Documentation

Bộ tài liệu kiến trúc cho dự án SignLearn E-Learning Platform.

## 📚 Tài liệu

| # | Tài liệu | Mô tả |
|---|----------|--------|
| 01 | [Problem Framing & Drivers](./01-problem-framing.md) | Bối cảnh kinh doanh, drivers, mapping trạng thái hiện tại (C4 + sequence diagram cho login & checkout) |
| 02 | [Target Architecture](./02-target-architecture.md) | Kiến trúc mục tiêu: layered monolith, middleware chain, frontend routing, security layers |
| 03 | [Architecture Decision Records](./03-adrs.md) | 9 ADR: chi router, pgx/v5, Redis, golang-migrate, React Router v7, session→JWT, slog, CORS, layered monolith |
| 04 | [Flows & Migration Plan](./04-flows-migration.md) | 6 luồng nghiệp vụ chính + kế hoạch migration Strangler Fig 12 tuần |

## 🎯 Câu hỏi thường gặp

**"Tại sao không tách microservices ngay?"**
→ Xem [ADR-009](./03-adrs.md#adr-009-không-tách-microservices-trong-giai-đoạn-này). Team hiện tại 3-5 người, 18K MAU — monolith có cấu trúc tốt hơn.

**"Tại sao chọn chi thay vì gin/echo?"**
→ Xem [ADR-001](./03-adrs.md#adr-001-dùng-chi-router-thay-cho-httpservemux-chuẩn). Chi là stdlib-friendly, middleware chain đúng net/http idiom.

**"Có nên dùng JWT không?"**
→ Xem [ADR-006](./03-adrs.md#adr-006-session-based-auth-giữ-ở-phase-1-chuyển-jwt-ở-phase-2). Phase 1 giữ session + Redis, phase 2 chuyển JWT khi scale.

**"Mất bao lâu để refactor?"**
→ Xem [Section 2 Migration Plan](./04-flows-migration.md#2-migration-plan-strangler-fig-pattern). 12 tuần, mỗi tuần 1 module, có feature flag rollback.

## 🔄 Quy trình cập nhật

- **PR thay đổi kiế trúc** → phải update ít nhất 1 file ở đây.
- **Quyết định mới quan trọng** → tạo ADR mới `05-NNN-title.md`.
- **C4 diagram thay đổi** → update file tương ứng.
- **Sequence flow mới** → thêm vào file 04.

## 🛠️ Công cụ liên quan

- **Skill đang dùng:** `software-architect` (7 sub-skills: ADR, documentation, cloud, data, security, enterprise, leadership)
- **Diagram format:** Mermaid (render trong GitHub, VSCode, Cursor)
- **DB migration:** golang-migrate
- **API spec:** OpenAPI 3.1 (TODO)

---

**Maintainer:** Backend Lead  
**Last updated:** 2026-06-17
