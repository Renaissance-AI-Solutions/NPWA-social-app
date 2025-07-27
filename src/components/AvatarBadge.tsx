
import React from 'react'
import {View} from 'react-native'
import {SvgXml} from 'react-native-svg'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

// Badge type definitions matching the lexicon schema
export type BadgeType = 'havana' | 'gangstalked' | 'targeted' | 'whistleblower' | 'retaliation'

export interface VictimBadge {
  badgeType: BadgeType
  verificationLevel: 0 | 1 | 2 | 3
  evidenceUri?: string
  verifiedAt?: string
}

interface Props {
  badges: VictimBadge[]
  size?: 'small' | 'medium' | 'large'
  showLabels?: boolean
  maxDisplay?: number
}

// Badge configurations with colors and labels
export const BADGE_CONFIG = {
  havana: {
    label: 'Havana Syndrome',
    color: '#FF6B6B',
    description: 'Neurological warfare victim'
  },
  gangstalked: {
    label: 'Gangstalked',
    color: '#9C27B0',
    description: 'Organized harassment victim'
  },
  targeted: {
    label: 'Targeted Individual',
    color: '#F44336',
    description: 'Systematic targeting victim'
  },
  whistleblower: {
    label: 'Whistleblower',
    color: '#4CAF50',
    description: 'Truth teller facing retaliation'
  },
  retaliation: {
    label: 'Retaliation',
    color: '#FF9800',
    description: 'Facing consequences for speaking out'
  }
}

// Badge SVG sources (inline for performance)
const BADGE_SVGS = {
  havana: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C15.5 3 18 5.5 18 9C18 10.5 17.5 11.8 16.7 12.8C17.5 13.5 18 14.5 18 15.5C18 17.4 16.4 19 14.5 19H9.5C7.6 19 6 17.4 6 15.5C6 14.5 6.5 13.5 7.3 12.8C6.5 11.8 6 10.5 6 9C6 5.5 8.5 3 12 3Z" stroke="#FF6B6B" stroke-width="2" fill="none"/>
    <path d="M3 8C3.5 8.5 4 9 4.5 9.5" stroke="#FF6B6B" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M3 12C3.5 12.5 4 13 4.5 13.5" stroke="#FF6B6B" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M21 8C20.5 8.5 20 9 19.5 9.5" stroke="#FF6B6B" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M21 12C20.5 12.5 20 13 19.5 13.5" stroke="#FF6B6B" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="12" cy="10" r="1.5" fill="#FF6B6B"/>
  </svg>`,
  
  gangstalked: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="8" rx="3.5" ry="2.5" stroke="#9C27B0" stroke-width="1.5" fill="none"/>
    <ellipse cx="16" cy="8" rx="3.5" ry="2.5" stroke="#9C27B0" stroke-width="1.5" fill="none"/>
    <ellipse cx="12" cy="16" rx="3.5" ry="2.5" stroke="#9C27B0" stroke-width="1.5" fill="none"/>
    <circle cx="8" cy="8" r="1" fill="#9C27B0"/>
    <circle cx="16" cy="8" r="1" fill="#9C27B0"/>
    <circle cx="12" cy="16" r="1" fill="#9C27B0"/>
    <path d="M8 8L12 16" stroke="#9C27B0" stroke-width="1" opacity="0.6"/>
    <path d="M16 8L12 16" stroke="#9C27B0" stroke-width="1" opacity="0.6"/>
    <path d="M8 8L16 8" stroke="#9C27B0" stroke-width="1" opacity="0.6"/>
    <circle cx="12" cy="12" r="10" stroke="#9C27B0" stroke-width="1" opacity="0.3" fill="none"/>
  </svg>`,
  
  targeted: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="#F44336" stroke-width="2" fill="none"/>
    <circle cx="12" cy="12" r="6" stroke="#F44336" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="3" stroke="#F44336" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="1" fill="#F44336"/>
    <path d="M12 2L12 6" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 18L12 22" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
    <path d="M2 12L6 12" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 12L22 12" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
    <path d="M4 4L6 6" stroke="#F44336" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M18 6L20 4" stroke="#F44336" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6 18L4 20" stroke="#F44336" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M20 20L18 18" stroke="#F44336" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  whistleblower: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="10" cy="12" rx="4" ry="2.5" stroke="#4CAF50" stroke-width="2" fill="none"/>
    <rect x="6" y="11" width="2" height="2" stroke="#4CAF50" stroke-width="2" fill="none"/>
    <path d="M10 9L10 6L12 4" stroke="#4CAF50" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="4" r="1" stroke="#4CAF50" stroke-width="1.5" fill="none"/>
    <path d="M15 10C16 10.5 16.5 11.5 16 12.5" stroke="#4CAF50" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M17 9C18.5 10 19 12 18 14" stroke="#4CAF50" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M19 8C21 9.5 21.5 12.5 20 15.5" stroke="#4CAF50" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M12 16L13 18" stroke="#4CAF50" stroke-width="1" stroke-linecap="round"/>
    <path d="M10 16L9 18" stroke="#4CAF50" stroke-width="1" stroke-linecap="round"/>
    <path d="M8 14L6 16" stroke="#4CAF50" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  
  retaliation: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L20 6V12C20 17 16 21 12 22C8 21 4 17 4 12V6L12 2Z" stroke="#FF9800" stroke-width="2" fill="none"/>
    <path d="M12 6L10 10L14 12L11 16" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8 8L10 12" stroke="#FF9800" stroke-width="1" stroke-linecap="round"/>
    <path d="M16 9L14 13" stroke="#FF9800" stroke-width="1" stroke-linecap="round"/>
    <circle cx="9" cy="9" r="0.5" fill="#FF9800"/>
    <circle cx="15" cy="10" r="0.5" fill="#FF9800"/>
    <circle cx="11" cy="15" r="0.5" fill="#FF9800"/>
    <path d="M12 1L13 3" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 21L11 23" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M3 12L1 12" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M21 12L23 12" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}

// Verification level indicators
const getVerificationColor = (level: number): string => {
  switch (level) {
    case 0: return '#9E9E9E' // Unverified - gray
    case 1: return '#2196F3' // Community verified - blue
    case 2: return '#FF9800' // Document verified - orange
    case 3: return '#4CAF50' // AI verified - green
    default: return '#9E9E9E'
  }
}

const getVerificationLabel = (level: number): string => {
  switch (level) {
    case 0: return 'Unverified'
    case 1: return 'Community Verified'
    case 2: return 'Document Verified'
    case 3: return 'AI Verified'
    default: return 'Unknown'
  }
}

export function AvatarBadge({badges, size = 'medium', showLabels = false, maxDisplay = 3}: Props) {
  const t = useTheme()
  
  if (!badges || badges.length === 0) {
    return null
  }

  const displayBadges = badges.slice(0, maxDisplay)
  const remainingCount = badges.length - maxDisplay

  const badgeSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24
  const containerStyle = size === 'small' ? a.gap_xs : size === 'medium' ? a.gap_sm : a.gap_md

  return (
    <View style={[a.flex_row, a.align_center, a.flex_wrap, containerStyle]}>
      {displayBadges.map((badge, index) => {
        const config = BADGE_CONFIG[badge.badgeType]
        const verificationColor = getVerificationColor(badge.verificationLevel)
        
        return (
          <View key={`${badge.badgeType}-${index}`} style={[a.flex_row, a.align_center, a.gap_xs]}>
            <View style={[
              a.relative,
              a.rounded_full,
              {
                width: badgeSize + 4,
                height: badgeSize + 4,
                backgroundColor: t.palette.contrast_25,
                padding: 2
              }
            ]}>
              <SvgXml 
                xml={BADGE_SVGS[badge.badgeType]} 
                width={badgeSize} 
                height={badgeSize}
              />
              
              {/* Verification level indicator */}
              <View style={[
                a.absolute,
                a.rounded_full,
                {
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  backgroundColor: verificationColor,
                  borderWidth: 1,
                  borderColor: t.palette.white
                }
              ]} />
            </View>
            
            {showLabels && (
              <View style={[a.flex_col]}>
                <Text style={[a.text_xs, a.font_bold, {color: config.color}]}>
                  {config.label}
                </Text>
                <Text style={[a.text_2xs, t.atoms.text_contrast_medium]}>
                  {getVerificationLabel(badge.verificationLevel)}
                </Text>
              </View>
            )}
          </View>
        )
      })}
      
      {remainingCount > 0 && (
        <View style={[
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {
            width: badgeSize + 4,
            height: badgeSize + 4,
            backgroundColor: t.palette.contrast_100
          }
        ]}>
          <Text style={[a.text_xs, a.font_bold, t.atoms.text_contrast_high]}>
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  )
}

// Helper function to get badge type from string
export function getBadgeTypeFromString(str: string): BadgeType | null {
  const validTypes: BadgeType[] = ['havana', 'gangstalked', 'targeted', 'whistleblower', 'retaliation']
  return validTypes.includes(str as BadgeType) ? str as BadgeType : null
}

// Helper function to create badge object
export function createVictimBadge(
  badgeType: BadgeType, 
  verificationLevel: 0 | 1 | 2 | 3 = 0,
  evidenceUri?: string
): VictimBadge {
  return {
    badgeType,
    verificationLevel,
    evidenceUri,
    verifiedAt: verificationLevel > 0 ? new Date().toISOString() : undefined
  }
} 