import { COLORS } from '../constants/colors';

const getQuestTypeStyles = (questType) => {
  switch (questType) {
    case 'bounty':
      return {
        borderColor: '#6b5fb7',
        titleColor: '#9d84ff',
        badgeBg: 'rgba(107, 95, 183, 0.3)',
        badgeColor: '#9d84ff',
      };
    case 'corrupted':
      return {
        borderColor: '#8b3a3a',
        titleColor: '#ff6b6b',
        badgeBg: 'rgba(139, 58, 58, 0.3)',
        badgeColor: '#ff8080',
      };
    default: // standard
      return {
        borderColor: COLORS.gold,
        titleColor: COLORS.gold,
        badgeBg: 'rgba(212, 175, 55, 0.1)',
        badgeColor: COLORS.gold,
      };
  }
};

export default function QuestCard({ quest, onComplete, isDailyBounty = false }) {
  const typeStyles = getQuestTypeStyles(quest.template.quest_type);

  return (
    <div className="relative p-6 md:p-8 mb-6 md:mb-8 shadow-lg" style={{backgroundColor: COLORS.darkPanel, borderColor: isDailyBounty ? '#6b5fb7' : typeStyles.borderColor, borderWidth: '3px'}}>
      {/* Decorative element */}
      <div className="absolute top-3 right-4 text-2xl opacity-20">⚔</div>

      {/* Quest Type Badge */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="px-2 py-1 rounded text-xs uppercase font-serif font-bold" style={{backgroundColor: typeStyles.badgeBg, color: typeStyles.badgeColor}}>
          {quest.template.quest_type}
        </span>
        {isDailyBounty && (
          <span className="px-2 py-1 rounded text-xs uppercase font-serif font-bold" style={{backgroundColor: 'rgba(107, 95, 183, 0.3)', color: '#9d84ff'}}>
            2x Bounty
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-2xl md:text-3xl font-serif font-bold pb-3 md:pb-4 mb-4 uppercase tracking-wider" style={{color: typeStyles.titleColor, borderBottomColor: typeStyles.titleColor, borderBottomWidth: '2px'}}>
        {quest.template.display_name || quest.template.title || 'Unknown Quest'}
      </h2>

      {/* Description */}
      <p className="italic leading-relaxed mb-6 md:mb-8 font-serif" style={{color: COLORS.parchment}}>
        {quest.template.description || 'No description'}
      </p>

      {/* Tags */}
      {quest.template.tags && (
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
          {quest.template.tags.split(',').map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs uppercase font-serif rounded"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                color: COLORS.gold,
                border: `1px solid ${COLORS.gold}`,
              }}
            >
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 md:gap-16 mt-6 md:mt-8 pt-6 md:pt-8" style={{borderTopColor: COLORS.redBorder, borderTopWidth: '1px'}}>
        <div className="text-center flex-1">
          <div className="text-xs uppercase tracking-widest mb-2 font-serif" style={{color: COLORS.brown}}>
            XP Reward
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{color: COLORS.gold}}>
            {quest.template.xp_reward || 0}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs uppercase tracking-widest mb-2 font-serif" style={{color: COLORS.brown}}>
            Gold Reward
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{color: COLORS.gold}}>
            {quest.template.gold_reward || 0}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs uppercase tracking-widest mb-2 font-serif" style={{color: COLORS.brown}}>
            Status
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{color: COLORS.gold}}>
            {quest.completed ? 'COMPLETED' : 'ACTIVE'}
          </div>
        </div>
      </div>

      {/* Complete Button */}
      {!quest.completed && (
        <button
          className="w-full mt-6 md:mt-8 py-3 md:py-4 px-4 font-serif font-semibold text-sm md:text-base uppercase tracking-wider transition-all duration-300 hover:shadow-lg cursor-pointer"
          style={{
            backgroundColor: 'rgba(95, 183, 84, 0.25)',
            borderColor: COLORS.greenSuccess,
            borderWidth: '2px',
            color: COLORS.greenSuccess
          }}
          onClick={() => onComplete(quest.id)}
        >
          ⚔ Complete Quest
        </button>
      )}
    </div>
  );
}
