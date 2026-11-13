import React from 'react';
import type { VerifiedReason } from '../../utils/userProfiles';
import { verifiedReasonLabel } from '../../utils/userProfiles';

interface VerifiedBadgeProps {
  reason?: VerifiedReason | null;
  size?: 'sm' | 'md';
  className?: string;
}

/** Blue check — Twitter/IG style, NEX Music. */
const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ reason = 'creator', size = 'sm', className = '' }) => {
  const px = size === 'md' ? 16 : 13;
  const title = verifiedReasonLabel(reason);
  return (
    <span
      className={`nex-verified-badge ${className}`}
      title={title}
      aria-label={title}
      role="img"
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
        <path
          d="M7.5 12.2l2.8 2.8 6.2-6.4"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        .nex-verified-badge {
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
          margin-left: 4px;
          line-height: 0;
          flex-shrink: 0;
        }
      `}</style>
    </span>
  );
};

export const NicknameWithBadge: React.FC<{
  name: string;
  verified?: boolean;
  reason?: VerifiedReason | null;
  prefix?: string;
  size?: 'sm' | 'md';
}> = ({ name, verified, reason, prefix = '', size = 'sm' }) => (
  <span className="nex-nickname-with-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
    {prefix}
    {name}
    {verified ? <VerifiedBadge reason={reason} size={size} /> : null}
  </span>
);

export default VerifiedBadge;
