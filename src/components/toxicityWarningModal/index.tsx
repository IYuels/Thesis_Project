import { AlertTriangle, X, AlertCircle, ThumbsDown } from 'lucide-react';
import { Button } from '../ui/button';
import { ToxicityResult } from '@/repository/toxicity.service';

// Enhanced modal component for toxicity warning
const ToxicityWarningModal = ({ 
  isOpen, 
  onClose, 
  toxicityData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  toxicityData: ToxicityResult | null | undefined;
}) => {
  if (!isOpen || !toxicityData) return null;

  // Map toxicity level to appropriate color and icon
  const getToxicityLevelInfo = () => {
    const toxicityLevel = toxicityData.summary?.toxicity_level || 'not toxic';

    switch (toxicityLevel) {
      case 'very toxic':
        return { color: 'red', icon: <ThumbsDown className="h-5 w-5 text-red-500 mr-2" /> };
      case 'toxic':
        return { color: 'yellow', icon: <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" /> };
      default:
        return { color: 'blue', icon: <AlertCircle className="h-5 w-5 text-blue-500 mr-2" /> };
    }
  };

  const { color, icon } = getToxicityLevelInfo();
  const headerColorClass = `bg-${color}-50 border-${color}-200`;
  
  // Helper to get user-friendly category names
  const getCategoryDisplayName = (category: string): string => {
    const displayNames: Record<string, string> = {
      'toxic': 'Toxic Content',
      'insult': 'Insults',
      'threat': 'Threatening Content',
      'identity_hate': 'Identity Attacks',
      'profanity': 'Profanity',
      'very_toxic': 'Very Toxic Content',
      'not_toxic': 'Non-Toxic'
    };
    
    return displayNames[category] || 
      category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <>
      {/* Modal backdrop */}
      <div 
        className="fixed inset-0 bg-transparent bg-opacity-30 z-40 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal content - stop propagation to prevent closing when clicking inside */}
        <div 
          className="bg-white rounded-lg shadow-lg w-11/12 max-w-md mx-auto z-50 overflow-hidden border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`p-4 ${headerColorClass} border-b flex justify-between items-center`}>
            <div className="flex items-center">
              {icon}
              <h3 className="font-semibold text-lg">
                Content Warning
                {toxicityData.summary?.toxicity_level && (
                  <span className="ml-2 text-sm font-normal">
                    ({toxicityData.summary.toxicity_level})
                  </span>
                )}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {toxicityData.summary?.detected_categories && toxicityData.summary.detected_categories.length > 0 && (
              <div className="mb-3">
                <span className="font-medium">Detected Categories: </span>
                <span className="text-red-600">
                  {toxicityData.summary.detected_categories.map(cat => getCategoryDisplayName(cat)).join(', ')}
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {toxicityData.results && Object.entries(toxicityData.results)
                .filter(([category, values]) => {
                  // Filter out low probability items (excluding NOT_TOXIC which we always want to show)
                  return values.probability > 0.1 || category.toUpperCase().includes("NOT_TOXIC");
                })
                .sort((a, b) => {
                  // Always put NOT_TOXIC at the top, then sort by probability
                  const aIsNotToxic = a[0].toUpperCase().includes("NOT_TOXIC");
                  const bIsNotToxic = b[0].toUpperCase().includes("NOT_TOXIC");
                  
                  if (aIsNotToxic && !bIsNotToxic) return -1;
                  if (!aIsNotToxic && bIsNotToxic) return 1;
                  return b[1].probability - a[1].probability;
                })
                .map(([category, values]) => (
                  <div key={category} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm font-medium">{getCategoryDisplayName(category)}</span>
                    <div className="flex items-center">
                      <span className={`text-sm ${values.is_detected ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {Math.round(values.probability * 100)}%
                      </span>
                      {values.is_detected && (
                        <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
            
            {toxicityData.censored_text && (
              <div className="mb-4">
                <span className="font-medium">Censored Version: </span>
                <p className="mt-1 p-2 bg-gray-50 rounded">{toxicityData.censored_text}</p>
              </div>
            )}
            
            <Button 
              onClick={onClose}
              className="w-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ToxicityWarningModal;