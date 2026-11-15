import React from 'react';

type DoubloonTier = 'green_doubloon' | 'orange_doubloon' | 'crimson_doubloon';

interface SFSDoubloonBadgeProps {
  tier: DoubloonTier;
  score: number;
  reason: string;
}

const COLORS = {
  green_doubloon: '#00FF88',
  orange_doubloon: '#FFAA00',
  crimson_doubloon: '#FF0044',
};

const LABELS = {
  green_doubloon: 'Green Doubloon',
  orange_doubloon: 'Orange Doubloon',
  crimson_doubloon: 'Crimson Doubloon',
};

export const SFSDoubloonBadge: React.FC<SFSDoubloonBadgeProps> = ({ tier, score, reason }) => {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      backgroundColor: COLORS[tier] + '22',
      border: `1px solid ${COLORS[tier]}`,
      color: COLORS[tier],
      fontWeight: 700,
      fontSize: 12,
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: COLORS[tier],
        display: 'inline-block',
      }}/>
      {LABELS[tier]} {score}
      <span style={{opacity:0.7, fontWeight:400, fontSize:10, marginLeft:4}} title={reason}>
        • {reason}
      </span>
    </div>
  );
};

export default SFSDoubloonBadge;
