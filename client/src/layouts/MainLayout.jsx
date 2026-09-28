import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar.jsx';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-muted">
        Peer-to-Peer Learning Platform · FYP
      </footer>
    </div>
  );
}
