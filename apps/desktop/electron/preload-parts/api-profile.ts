import { ipcRenderer } from 'electron'

import type { ProfileCharacter } from '../../src/types/team'

export const profileApi = {
  authSetCharacter: (character: ProfileCharacter | null) =>
    ipcRenderer.invoke('auth:setCharacter', character),
  authReadLevel: (timeZone: string) => ipcRenderer.invoke('auth:readLevel', timeZone),
}
