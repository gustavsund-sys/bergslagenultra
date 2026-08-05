import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const PublicLayout = ({ children }) => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
  </div>
);
