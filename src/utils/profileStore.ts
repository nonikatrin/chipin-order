import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BusinessProfile } from '../po/types'; // Safe relative import paths

interface ProfileState {
  profile: BusinessProfile;
  updateProfile: (updates: Partial<BusinessProfile>) => void;
}

export const defaultProfile: BusinessProfile = {
  storeName: 'Chip!n Mitra',
  street: '',
  city: '',
  province: '',
  whatsappNumber: '',
  email: '',
  currency: 'IDR', // Defaulting to your application base currency
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),
    }),
    {
      name: 'chipinorder-profile', // Completely isolated namespace
    }
  )
);