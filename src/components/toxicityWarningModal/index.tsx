import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';

// Modal component for toxicity warning
const ToxicityWarningModal = ({ 
  isOpen, 
  onClose, 
  toxicityData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  toxicityData: { 
    detected_categories: string[]; 
    results: Record<string, { probability: number; is_detected: boolean }> 
  } | null | undefined;
}) => {
  if (!isOpen || !toxicityData) return null;

  return (
    <>
      {/* Modal backdrop */}
      <div 
        className="fixed inset-0 bg-transparent bg-opacity-50 z-40 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal content - stop propagation to prevent closing when clicking inside */}
        <div 
          className="bg-white rounded-lg shadow-lg w-11/12 max-w-md mx-auto z-50 overflow-hidden border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 bg-yellow-50 border-b border-yellow-200 flex justify-between items-center">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              <h3 className="font-semibold text-lg">Content Warning</h3>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <div className="mb-3">
              <span className="font-medium">Categories: </span>
              <span className="text-red-600">
                {toxicityData.detected_categories.join(', ')}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {Object.entries(toxicityData.results)
                .filter(([_, values]) => values.probability > 0.2)
                .sort((a, b) => b[1].probability - a[1].probability)
                .map(([category, values]) => {
                  // Check if category contains NOT_TOXIC (case insensitive)
                  const isNotToxic = category.toUpperCase().includes("NOT_TOXIC");
                  const textColorClass = isNotToxic 
                    ? "text-gray-600" 
                    : (values.is_detected ? "text-red-600" : "text-gray-600");
                  
                  // Format category name for better display
                  const formattedCategory = category
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, l => l.toUpperCase());
                  
                  return (
                    <div key={category} className="flex items-center justify-between">
                      <span className="truncate pr-2">{formattedCategory}:</span>
                      <span className={`font-medium ${textColorClass}`}>
                        {Math.round(values.probability * 100)}%
                      </span>
                    </div>
                  );
                })
              }
            </div>
            
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