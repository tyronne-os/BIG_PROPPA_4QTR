"""
SFS Doubloon Parlay Replacement Engine
Auto-replace Crimson Doubloon players with Green Doubloon players
"""

from backend.sfs_doubloon_engine import compute_doubloon, DoubloonTier, SFSMetrics

def filter_parlay_candidates(candidates):
    green_pool = []
    orange_pool = []
    crimson_pool = []
    
    for c in candidates:
        tier, score, reason = compute_doubloon(c['metrics'])
        c['doubloon_tier'] = tier
        c['doubloon_score'] = score
        c['doubloon_reason'] = reason
        
        if tier == DoubloonTier.GREEN:
            green_pool.append(c)
        elif tier == DoubloonTier.ORANGE:
            orange_pool.append(c)
        else:
            crimson_pool.append(c)
    
    # Replace crimson with green where possible
    replaced = []
    for c in crimson_pool:
        # Find best green replacement in same prop category
        replacement = next((g for g in green_pool if g['prop_category'] == c['prop_category'] and g['team'] == c['team']), None)
        if replacement:
            replaced.append({
                'original': c,
                'replacement': replacement,
                'reason': 'Crimson lockout replaced with Green Doubloon'
            })
            green_pool.remove(replacement)
        else:
            replaced.append({
                'original': c,
                'replacement': None,
                'reason': 'No Green replacement available, parlay leg removed'
            })
    
    return {
        'green': green_pool,
        'orange': orange_pool,
        'crimson_removed': replaced
    }
