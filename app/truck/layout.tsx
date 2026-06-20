'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import {
  LayoutDashboard, BookOpen, Truck, BarChart2,
  Settings, ExternalLink, LogOut, Building2, Navigation,
} from 'lucide-react';

const NAV = [
  { href: '/truck', icon: LayoutDashboard, label: 'Overview' },
  { href: '/truck/bookings', icon: BookOpen, label: 'All Bookings' },
  { href: '/truck/city', icon: Building2, label: 'City Delivery' },
  { href: '/truck/outstation', icon: Navigation, label: 'Outstation' },
  { href: '/truck/drivers', icon: Truck, label: 'Drivers' },
  { href: '/truck/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/truck/settings', icon: Settings, label: 'Settings' },
];

export default function TruckLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('truck_panel_token')) router.push('/');
  }, [router]);

  function logout() {
    localStorage.removeItem('truck_panel_token');
    router.push('/');
  }

  function isActive(href: string) {
    if (href === '/truck') return pathname === '/truck';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Navy Sidebar */}
      <aside className="w-56 h-screen flex flex-col fixed left-0 top-0 z-30" style={{ backgroundColor: '#1E3A5F' }}>
        {/* Logo */}
        <div className="p-6 border-b border-blue-900">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚛</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">gogoo</p>
              <p className="text-xs font-medium" style={{ color: '#93C5FD' }}>Truck Operations</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.href)
                  ? 'bg-white/15 text-white font-semibold'
                  : 'hover:bg-white/10 hover:text-white'
              }`}
              style={{ color: isActive(item.href) ? '#FFFFFF' : '#93C5FD' }}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-blue-900 space-y-2">
          <a
            href="https://gogoo-dashboard-production.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm transition-colors hover:text-white"
            style={{ color: '#93C5FD' }}
          >
            <ExternalLink size={14} />
            Master Panel
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm transition-colors hover:text-white w-full"
            style={{ color: '#93C5FD' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-56 flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#3B82F6' }} />
            <span className="text-sm text-gray-500">Truck Operations Panel</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
