export type Developer = {
  slug: string;
  name: string;
  headline: string;
  headlineVi: string;
  bio: string;
  bioVi: string;
  specialties: string[];
  avatar: string;
  products: number;
  views: number;
  orders: number;
  rating: number;
  reviewCount: number;
  joined: string;
  email: string;
  phone: string;
  verified?: boolean;
};
export const developers: Developer[] = [
  {
    slug: 'northstar-automation',
    name: 'Northstar Automation',
    headline: 'Browser workflow specialists',
    headlineVi: 'Chuyên gia quy trình trình duyệt',
    bio: 'A small automation studio building maintainable browser workflows.',
    bioVi: 'Nhóm tự động hóa xây dựng quy trình trình duyệt dễ bảo trì.',
    specialties: ['Browser automation', 'Node.js'],
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    products: 3,
    views: 2090,
    orders: 355,
    rating: 4.9,
    reviewCount: 86,
    joined: '13 Mar 2025',
    email: 'hello@northstar.dev',
    phone: '+84 338 973 258',
  },
  {
    slug: 'data-foundry',
    name: 'Data Foundry',
    headline: 'Practical data extraction tools',
    headlineVi: 'Công cụ trích xuất dữ liệu thực tiễn',
    bio: 'Independent sellers focused on useful document and marketplace data.',
    bioVi: 'Nhóm người bán tập trung vào dữ liệu tài liệu và sàn thương mại.',
    specialties: ['Data extraction', 'Python'],
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    products: 2,
    views: 1400,
    orders: 182,
    rating: 4.8,
    reviewCount: 51,
    joined: '08 Feb 2025',
    email: 'team@datafoundry.dev',
    phone: '+84 286 110 982',
  },
  {
    slug: 'signal-workshop',
    name: 'Signal Workshop',
    headline: 'Reliable monitoring utilities',
    headlineVi: 'Tiện ích giám sát đáng tin cậy',
    bio: 'Focused tools for release and listing operations.',
    bioVi: 'Công cụ tập trung cho theo dõi phát hành và vận hành danh sách.',
    specialties: ['Monitoring', 'Operations'],
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    products: 2,
    views: 1230,
    orders: 108,
    rating: 4.7,
    reviewCount: 37,
    joined: '22 Jan 2025',
    email: 'contact@signalworkshop.dev',
    phone: '+84 284 221 102',
  },
  {
    slug: 'hideauto',
    name: 'HideAuto',
    headline: 'Automation tools for practical work',
    headlineVi: 'Công cụ tự động hóa cho công việc thực tế',
    bio: 'The HideAuto team publishes dependable automation building blocks.',
    bioVi: 'Đội ngũ HideAuto phát hành các công cụ tự động hóa đáng tin cậy.',
    specialties: ['Automation', 'Automation tools'],
    avatar: '/images/icon.png',
    products: 5,
    views: 3850,
    orders: 490,
    rating: 5,
    reviewCount: 142,
    joined: '01 Jan 2025',
    email: 'team@hideauto.dev',
    phone: '+84 286 999 100',
    verified: true,
  },
  {
    slug: 'orbit-labs',
    name: 'Orbit Labs',
    headline: 'Structured operations helpers',
    headlineVi: 'Công cụ hỗ trợ vận hành có cấu trúc',
    bio: 'A product-minded seller group for daily operations.',
    bioVi:
      'Nhóm phát triển định hướng sản phẩm cho công việc vận hành hằng ngày.',
    specialties: ['Operations', 'Node.js'],
    avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    products: 4,
    views: 980,
    orders: 96,
    rating: 4.6,
    reviewCount: 28,
    joined: '17 Apr 2025',
    email: 'hello@orbitlabs.dev',
    phone: '+84 288 555 121',
  },
  {
    slug: 'pixel-data',
    name: 'Pixel Data',
    headline: 'Clean data from complex pages',
    headlineVi: 'Dữ liệu sạch từ các trang phức tạp',
    bio: 'Data-focused seller building concise extraction workflows.',
    bioVi:
      'Người bán tập trung dữ liệu xây dựng quy trình trích xuất gọn gàng.',
    specialties: ['Data extraction', 'Web'],
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    products: 3,
    views: 740,
    orders: 65,
    rating: 4.5,
    reviewCount: 19,
    joined: '06 May 2025',
    email: 'contact@pixeldata.dev',
    phone: '+84 287 220 456',
  },
];
export function developerSlug(name: string) {
  return name.toLowerCase().replaceAll(' ', '-');
}
