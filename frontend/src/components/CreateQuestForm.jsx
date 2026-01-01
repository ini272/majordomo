import { useState } from 'react';
import { api } from '../services/api';
import { COLORS } from '../constants/colors';

const AVAILABLE_TAGS = ['Chores', 'Learning', 'Exercise', 'Health', 'Organization'];

export default function CreateQuestForm({ token, onQuestCreated, onClose }) {
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const userId = parseInt(localStorage.getItem('userId'));
    if (!userId) {
      setError('User ID not found in session');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newTemplate = await api.quests.createTemplate(
        {
          title: title.trim(),
          display_name: null,
          description: null,
          tags: selectedTags.length > 0 ? selectedTags.join(',') : null,
          xp_reward: 25,
          gold_reward: 15,
          quest_type: 'standard',
          recurrence: 'one-off',
        },
        token,
        userId
      );

      // Create quest instance from template
      const newQuest = await api.quests.create(
        {
          quest_template_id: newTemplate.id,
        },
        token,
        userId
      );

      setTitle('');
      setSelectedTags([]);
      onQuestCreated?.(newQuest);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md p-6 rounded-lg shadow-xl"
        style={{ backgroundColor: COLORS.darkPanel, borderColor: COLORS.gold, borderWidth: '2px' }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold" style={{ color: COLORS.gold }}>
            Create Quest
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none"
            style={{ color: COLORS.gold }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="px-3 py-2 mb-4 rounded-sm text-sm font-serif"
            style={{
              backgroundColor: COLORS.redDarker,
              borderColor: COLORS.redBorder,
              borderWidth: '1px',
              color: COLORS.redLight,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm uppercase tracking-wider mb-2 font-serif" style={{ color: COLORS.gold }}>
              Quest Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Clean Kitchen"
              className="w-full px-3 py-2 font-serif focus:outline-none focus:shadow-lg transition-all"
              style={{
                backgroundColor: COLORS.black,
                borderColor: COLORS.gold,
                borderWidth: '2px',
                color: COLORS.parchment,
              }}
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm uppercase tracking-wider mb-2 font-serif" style={{ color: COLORS.gold }}>
              Tags (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter((t) => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className="px-3 py-1 text-xs uppercase tracking-wider font-serif rounded transition-all"
                  style={{
                    backgroundColor: selectedTags.includes(tag)
                      ? COLORS.gold
                      : `rgba(212, 175, 55, 0.2)`,
                    color: selectedTags.includes(tag) ? COLORS.darkPanel : COLORS.gold,
                    border: `1px solid ${COLORS.gold}`,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                  disabled={loading}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300"
            style={{
              backgroundColor: loading || !title.trim() ? `rgba(212, 175, 55, 0.1)` : `rgba(212, 175, 55, 0.2)`,
              borderColor: COLORS.gold,
              borderWidth: '2px',
              color: COLORS.gold,
              cursor: loading || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !title.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Quest'}
          </button>
        </form>
      </div>
    </div>
  );
}
