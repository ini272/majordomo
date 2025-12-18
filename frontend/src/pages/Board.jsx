import { useState, useEffect } from 'react';
import QuestCard from '../components/QuestCard';
import { api } from '../services/api';
import { COLORS } from '../constants/colors';

export default function Board({ token, onQuestUpdate }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuests = async () => {
      setLoading(true);
      try {
        const data = await api.quests.getAll(token);
        setQuests(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuests();
  }, [token]);

  const handleCompleteQuest = async (questId) => {
    try {
      const updated = await api.quests.complete(questId, token);
      setQuests(quests.map(q => q.id === questId ? updated : q));
      setError(null);
      // Notify parent to update hero stats
      onQuestUpdate?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="px-4 py-3 mb-6 rounded-sm font-serif" style={{backgroundColor: COLORS.redDarker, borderColor: COLORS.redBorder, borderWidth: '1px', color: COLORS.redLight}}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 md:py-16 font-serif" style={{color: COLORS.brown}}>
          Loading quests...
        </div>
      )}

      {/* Quests List */}
      {quests.length > 0 ? (
        <div>
          {quests.map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onComplete={handleCompleteQuest}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-12 md:py-16 font-serif" style={{color: COLORS.brown}}>
            No quests found
          </div>
        )
      )}
    </div>
  );
}
