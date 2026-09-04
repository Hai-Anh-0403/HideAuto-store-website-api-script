export type AdvertisingPlacement = {
  slotId:
    | 'home-after-top-views'
    | 'home-between-rails'
    | 'home-footer'
    | 'catalog-after-results'
    | 'developers-after-directory'
    | 'script-detail-after-description';
  placement: 'home' | 'catalog' | 'developers' | 'script-detail';
  active: boolean;
  label: string;
  campaignId?: string;
  startsAt?: string;
  endsAt?: string;
  creativeUrl?: string;
  creativeAlt?: string;
  destinationUrl?: string;
};

export const advertisingPlacements: AdvertisingPlacement[] = [
  {
    slotId: 'home-after-top-views',
    placement: 'home',
    active: false,
    label: 'Advertisement',
  },
  {
    slotId: 'home-between-rails',
    placement: 'home',
    active: false,
    label: 'Advertisement',
  },
  {
    slotId: 'home-footer',
    placement: 'home',
    active: false,
    label: 'Advertisement',
  },
  {
    slotId: 'catalog-after-results',
    placement: 'catalog',
    active: false,
    label: 'Advertisement',
  },
  {
    slotId: 'developers-after-directory',
    placement: 'developers',
    active: false,
    label: 'Advertisement',
  },
  {
    slotId: 'script-detail-after-description',
    placement: 'script-detail',
    active: false,
    label: 'Advertisement',
  },
];
