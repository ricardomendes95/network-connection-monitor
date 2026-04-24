import { create } from 'zustand'
import type {
  ActiveNetworkState,
  LiveMatchStatus,
  LiveNetworkInfo,
  Network,
  NetworkCreateInput,
  NetworkUpdateInput
} from '../types'
import { ipc } from '../lib/ipc'

interface NetworksStore {
  networks: Network[]
  active: Network | null
  live: LiveNetworkInfo | null
  liveMatch: LiveMatchStatus
  manualOverride: boolean
  loaded: boolean

  refresh: () => Promise<void>
  applyState: (state: ActiveNetworkState) => void
  setActive: (id: number) => Promise<void>
  create: (input: NetworkCreateInput) => Promise<Network>
  update: (id: number, patch: NetworkUpdateInput) => Promise<Network>
  remove: (id: number) => Promise<void>
}

export const useNetworksStore = create<NetworksStore>((set, get) => ({
  networks: [],
  active: null,
  live: null,
  liveMatch: 'unknown',
  manualOverride: false,
  loaded: false,

  refresh: async (): Promise<void> => {
    const [networks, state] = await Promise.all([
      ipc.listNetworks(),
      ipc.getActiveNetwork()
    ])
    set({
      networks,
      active: state.active,
      live: state.live,
      liveMatch: state.liveMatch,
      manualOverride: state.manualOverride,
      loaded: true
    })
  },

  applyState: (state) => {
    set((prev) => ({
      ...prev,
      active: state.active,
      live: state.live,
      liveMatch: state.liveMatch,
      manualOverride: state.manualOverride
    }))
  },

  setActive: async (id) => {
    const state = await ipc.setActiveNetwork(id)
    get().applyState(state)
  },

  create: async (input) => {
    const created = await ipc.createNetwork(input)
    await get().refresh()
    return created
  },

  update: async (id, patch) => {
    const updated = await ipc.updateNetwork(id, patch)
    await get().refresh()
    return updated
  },

  remove: async (id) => {
    await ipc.deleteNetwork(id)
    await get().refresh()
  }
}))
