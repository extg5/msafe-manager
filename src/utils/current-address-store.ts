import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createJSONStorage } from "zustand/middleware"

export const useCurrentAddressStore = create(
  persist<{
    currentAddress: string | null
    setCurrentAddress: (address: string | null) => void
  }>((set) => ({
    currentAddress: null,
    setCurrentAddress: (address) => set({ currentAddress: address })
  }), {
    name: 'current-address',
    storage: createJSONStorage(() => localStorage)
  })
)