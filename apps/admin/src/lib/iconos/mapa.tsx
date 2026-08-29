import {
  AtSign,
  Award,
  BarChart3,
  Calendar,
  Camera,
  Clapperboard,
  Clock,
  Crown,
  Film,
  Gift,
  Heart,
  Link,
  MapPin,
  MessageCircle,
  Music,
  Play,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mapa ESTÁTICO, no un import dinámico por nombre: resolver `lucide-react` en
 * runtime obliga a meter el paquete entero en el bundle o a hacerlo `lazy`.
 * Estos imports pesan menos **y hacen imposible renderizar un nombre inválido**.
 *
 * Y ya se ganó el sitio: la primera versión incluía `Instagram`, que **lucide
 * ya no exporta** —quitaron las marcas—. Con resolución dinámica habría caído
 * al ícono de reserva en silencio; así no compiló.
 */
const MAPA: Record<string, LucideIcon> = {
  clapperboard: Clapperboard,
  'trending-up': TrendingUp,
  crown: Crown,
  camera: Camera,
  zap: Zap,
  users: Users,
  'bar-chart-3': BarChart3,
  video: Video,
  film: Film,
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  gift: Gift,
  clock: Clock,
  award: Award,
  music: Music,
  calendar: Calendar,
  'map-pin': MapPin,
  play: Play,
  'message-circle': MessageCircle,
  'at-sign': AtSign,
  'share-2': Share2,
  link: Link,
};

export const iconoDe = (nombre: string | null | undefined): LucideIcon =>
  (nombre && MAPA[nombre]) || Link;
