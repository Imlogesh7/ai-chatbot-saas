import { LayoutGrid, Bot, MessageSquare, Settings, LogOut } from 'lucide-react';
import { MenuConfig } from '@/config/types';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/dashboard',
  },
  {
    title: 'Chatbots',
    icon: Bot,
    path: '/chatbots',
  },
];

export const MENU_MEGA: MenuConfig = [
  { title: 'Dashboard', path: '/dashboard' },
  { title: 'Chatbots', path: '/chatbots' },
];

export const MENU_MEGA_MOBILE: MenuConfig = [
  { title: 'Dashboard', path: '/dashboard' },
  { title: 'Chatbots', path: '/chatbots' },
];
