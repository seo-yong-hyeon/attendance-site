import "./globals.css";

export const metadata = {
  title: "세연중학교 출석부",
  description: "담임용 조회·종례 출결 기록",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
