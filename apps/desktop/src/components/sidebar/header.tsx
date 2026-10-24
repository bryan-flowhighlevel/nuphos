import { ChevronRight, ChevronsUpDown, Loader2, LogOut, Settings } from 'lucide-react'

import { usePendingPick } from '../../hooks/usePendingPick'
import { shownCharacter } from '../../lib/profilePickSync'
import { Avatar } from '../Avatar'
import { SidebarCharacter } from './SidebarCharacter'
import { ProfileCharacterImage } from '../ProfileCharacterImage'
import { SkeletonReveal } from '../SkeletonReveal'
import { Kbd } from '../ui/kbd'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuTrigger,
} from '../ui/menu'
import { renderWorkspaceMenuOptions } from '../WorkspaceMenuOptions'

import { SidebarHistoryButtons } from './history-buttons'
import { SidebarToggleButton } from './nav-stack'

import type { AgentConversation } from '../../api'
import type { HistoryTimeline } from './historyRows'
import type { UserInfo } from '../../types'
import type { BreadcrumbSegment } from '../Toolbar'

/**
 * The 44px strip at the top of the sidebar: the collapse toggle on the leading
 * edge, history buttons on the trailing one. Doubles as the window titlebar.
 */
export function SidebarHeaderBar({
  collapsed,
  onToggleCollapse,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  history,
  chatTitle,
}: {
  collapsed: boolean
  onToggleCollapse?: () => void
  canGoBack: boolean
  canGoForward: boolean
  onBack?: () => void
  onForward?: () => void
  history?: HistoryTimeline
  chatTitle?: (sessionId: string) => string | undefined
}) {
  return (
    <div className="titlebar-drag h-[44px] flex-shrink-0 flex items-center justify-between px-3.5">
      {/* On macOS the leading padding clears the traffic lights; elsewhere
        (Windows/Linux) there are none, so the toggle sits flush left. */}
      <div className="titlebar-no-drag flex items-center titlebar-lead-pad">
        {onToggleCollapse && (
          <SidebarToggleButton collapsed={collapsed} onClick={onToggleCollapse} />
        )}
      </div>
      <SidebarHistoryButtons
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={onBack}
        onForward={onForward}
        history={history}
        chatTitle={chatTitle}
      />
    </div>
  )
}

/** Placeholder shown while the team segment is still loading; SkeletonReveal pulses it. */
function SidebarTeamSwitcherSkeleton() {
  return (
    <div className="px-2.5 pb-1.5">
      <div className="h-9 flex items-center gap-2.5 px-2">
        <div className="h-5 w-5 flex-shrink-0 rounded-md bg-zGray-800/80" />
        <div className="h-3.5 w-28 rounded bg-zGray-800/65" />
      </div>
    </div>
  )
}

type TeamSwitcherActions = {
  onOpenSettings?: () => void
  onOpenMyPreferences?: () => void
  onCreateTeam?: () => void
  /** The signed-in person: their character takes the workspace tile's place. */
  user?: UserInfo | null
  onUserUpdated?: (user: UserInfo) => void
  /** This workspace, its sessions and the sidebar's row opener, for the character's badge. */
  badgeData?: {
    teamId: string
    sessions: readonly AgentConversation[]
    onSelect: (key: string) => void
  }
}

/** The team switcher, revealed from its skeleton once the team segment loads. */
export function SidebarTeamSwitcher({
  teamSegment,
  loading,
  ...actions
}: TeamSwitcherActions & { teamSegment?: BreadcrumbSegment; loading: boolean }) {
  if (!teamSegment && !loading) return null

  return (
    <SkeletonReveal ready={Boolean(teamSegment)} skeleton={<SidebarTeamSwitcherSkeleton />}>
      {teamSegment && <TeamSwitcherMenu teamSegment={teamSegment} {...actions} />}
    </SkeletonReveal>
  )
}

function TeamSwitcherMenu({
  teamSegment,
  onOpenSettings,
  onOpenMyPreferences,
  onCreateTeam,
  user,
  onUserUpdated,
  badgeData,
}: TeamSwitcherActions & { teamSegment: BreadcrumbSegment }) {
  const tile = (
    <span className="flex items-center flex-shrink-0 [&>*]:!h-5 [&>*]:!w-5 [&>svg]:!h-5 [&>svg]:!w-5">
      {teamSegment.icon}
    </span>
  )
  // The person's character sits beside the switcher, not inside it, so each opens on its own.
  const character = user && onUserUpdated && !teamSegment.loading

  return (
    <div className="px-2.5 pb-1.5 titlebar-no-drag flex items-center gap-1">
      {character && (
        <span className="flex h-9 flex-none items-center pl-1.5">
          <SidebarCharacter
            user={user}
            fallback={tile}
            teamId={badgeData?.teamId}
            sessions={badgeData?.sessions}
            onOpenSession={
              badgeData && ((sessionId) => badgeData.onSelect(`agent-session:${sessionId}`))
            }
            onUserUpdated={onUserUpdated}
          />
        </span>
      )}
      <Menu
        onOpenChange={(open) => {
          if (open) teamSegment.onExpand?.()
        }}
      >
        <MenuTrigger className="min-w-0 flex-1 h-9 flex items-center gap-2.5 px-2 rounded-md text-[13.5px] transition-colors outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-[var(--sidebar-overlay-focus)] hover:bg-[var(--sidebar-overlay-hover)] text-main data-[popup-open]:bg-[var(--sidebar-overlay-active)]">
          {teamSegment.loading ? (
            <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-zViolet-accent" />
          ) : (
            !character && tile
          )}
          <span className="truncate flex-1 text-left font-medium">{teamSegment.label}</span>
          {!teamSegment.loading && (
            <ChevronsUpDown className="w-3.5 h-3.5 flex-shrink-0 text-tertiary" />
          )}
        </MenuTrigger>
        <MenuContent side="bottom" align="start" className="w-[260px]">
          {onOpenSettings && (
            <MenuItem hint={<Kbd combo="mod+shift+," />} onClick={() => onOpenSettings()}>
              Team settings
            </MenuItem>
          )}
          {onOpenMyPreferences && (
            <MenuItem onClick={() => onOpenMyPreferences()}>My preferences</MenuItem>
          )}
          <MenuSubmenu>
            <MenuSubmenuTrigger
              chevron={<ChevronRight className="w-3 h-3" />}
              disabled={!teamSegment.options || teamSegment.options.length === 0}
            >
              Switch workspace
            </MenuSubmenuTrigger>
            <MenuContent align="start" className="w-[260px]">
              {teamSegment.options && teamSegment.options.length > 0 ? (
                <>
                  {renderWorkspaceMenuOptions(teamSegment.options)}
                  {onCreateTeam && (
                    <>
                      <MenuSeparator />
                      <MenuItem onClick={() => onCreateTeam()}>Create or join team</MenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="px-2.5 py-2 text-tertiary text-[12.5px]">
                    {teamSegment.emptyText || 'No teams'}
                  </div>
                  {onCreateTeam && (
                    <>
                      <MenuSeparator />
                      <MenuItem onClick={() => onCreateTeam()}>Create or join team</MenuItem>
                    </>
                  )}
                </>
              )}
            </MenuContent>
          </MenuSubmenu>
        </MenuContent>
      </Menu>
    </div>
  )
}

/** The person's own picture: their profile character once picked, else their photo or initials. */
function UserPicture({ user, name, size }: { user: UserInfo; name: string; size: number }) {
  // A pick still waiting on this computer shows here too, as it does in the profile ring.
  const character = shownCharacter(user, usePendingPick(user.id))

  if (!character)
    return (
      <Avatar
        src={user.avatarURL}
        name={name}
        size={size}
        className="rounded-full !shadow-none flex-shrink-0"
      />
    )

  return (
    <span
      className="flex-shrink-0 overflow-hidden rounded-full bg-zViolet-accent/10"
      style={{ width: size, height: size }}
    >
      <ProfileCharacterImage character={character} className="h-full w-full" />
    </span>
  )
}

export function SidebarUserEntry({
  user,
  onOpenUserSettings,
  onLogout,
}: {
  user: UserInfo
  onOpenUserSettings?: () => void
  onLogout: () => void
}) {
  const name = user.name || user.username || user.email

  return (
    <Menu>
      <MenuTrigger className="titlebar-no-drag min-w-0 flex-1 h-9 flex items-center gap-2.5 px-2 rounded-lg text-[13.5px] text-main outline-none transition-colors hover:bg-[var(--sidebar-overlay-hover)] focus-visible:bg-[var(--sidebar-overlay-focus)] data-[popup-open]:bg-[var(--sidebar-overlay-active)]">
        <UserPicture user={user} name={name} size={22} />
        <span className="truncate font-medium">{name}</span>
      </MenuTrigger>
      <MenuContent side="top" align="start" sideOffset={8} className="w-[260px] !rounded-xl !p-1.5">
        <div className="flex items-center gap-2.5 px-2 pb-2.5 pt-1.5">
          <UserPicture user={user} name={name} size={28} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-main">{name}</div>
            {user.email && <div className="truncate text-[12px] text-tertiary">{user.email}</div>}
          </div>
        </div>
        <MenuSeparator />
        {onOpenUserSettings && (
          <MenuItem
            icon={<Settings className="h-3.5 w-3.5" />}
            hint={<Kbd combo="mod+," />}
            onClick={() => onOpenUserSettings()}
          >
            Settings
          </MenuItem>
        )}
        <MenuItem icon={<LogOut className="h-3.5 w-3.5" />} onClick={() => onLogout()}>
          Log out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
