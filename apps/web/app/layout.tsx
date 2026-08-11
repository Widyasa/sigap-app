import { AuthProvider } from './_lib/auth';
import { DashboardNav } from './_lib/DashboardNav';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <DashboardNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
