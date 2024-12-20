import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Step } from 'react-joyride';

interface GuidedJourneyContextType {
  isGuided: boolean;
  stepIndex: number;
  journeyType: string | null;
  steps: Step[];
  hasTakenTour: boolean;
  isLoading: boolean;
  error: string | null;
  startJourney: (type: string) => Promise<void>;
  endJourney: () => void;
  setStepIndex: (index: number) => void;
  markTourComplete: () => void;
}

const TOUR_COMPLETED_KEY = 'guided_tour_completed';
const API_BASE_URL = import.meta.env.VITE_APP_BE;
const POLLING_INTERVAL = 5000; // 5 seconds

interface JourneyData {
  steps: Step[];
  // Add other fields from your API response here
}

interface PollResponse {
  active: string;
  // Add other fields that might come from the API
}

const journeySteps: Record<string, Step[]> = {
  'view-pin': [
    {
      target: '[data-testid="cards-button"]',
      content: 'Firstly, tap on Cards in the bottom navigation',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-testid="view-pin-button"]',
      content: 'Tap View Pin to see the Pin information',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-testid="show-pin-button"]',
      content: 'Finally, tap Show PIN to see your card PIN',
      placement: 'top',
      disableBeacon: true,
    }
  ],
  'replace-card': [
    {
      target: '[data-testid="support-card-management-card"]',
      content: 'First, tap on Card Management',
      placement: 'top',
    },
    {
      target: '[data-testid="lost-stolen-button"]',
      content: 'Then select Lost or Stolen Card option',
      placement: 'top',
    }
  ]
};

const GuidedJourneyContext = createContext<GuidedJourneyContextType | undefined>(undefined);

export const GuidedJourneyProvider = ({ children }: { children: ReactNode }) => {
  const [isGuided, setIsGuided] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [journeyType, setJourneyType] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [hasTakenTour, setHasTakenTour] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBeenYes, setHasBeenYes] = useState(false);
  const pollActiveStatus = async () => {
    if (hasBeenYes) {
      return
    }
    try {
      const response = await fetch(`https://apphelp-cugtbgavhge7eqbn.uksouth-01.azurewebsites.net/status/adam`);

      if (!response.ok) {
        throw new Error('Failed to fetch active status');
      }
      const data: PollResponse = await response.json();
      console.log('data', data);
      if (data.active === 'true') {
        setHasBeenYes(true)
        setIsGuided(true);
        startJourney('view-pin');
      }

      // If active status becomes true and we're not already in a journey,
      // automatically start the view-pin journey
      if (data.active && isGuided) {
      }
    } catch (err) {
      console.error('Error polling active status:', err);
      // Don't set error state here to avoid UI disruption
    }
  };

  useEffect(() => {
    // Start polling when component mounts
    console.log('POLLING!')
    const intervalId = setInterval(pollActiveStatus, POLLING_INTERVAL);

    // Cleanup interval when component unmounts
    return () => clearInterval(intervalId);
  }, [isGuided]); // Add isGuided as dependency to prevent starting multiple journeys

  const fetchJourneyData = async (type: string): Promise<JourneyData> => {
    try {
      const response = await fetch(`${API_BASE_URL}/journey/adam`);
      if (!response.ok) {
        throw new Error('Failed to fetch journey data');
      }
      return response.json();
    } catch (err) {
      console.error('Error fetching journey data:', err);
      throw err;
    }
  };

  const startJourney = async (type: string) => {
    console.log('startJourney', type);
    setIsLoading(true);
    setError(null);

    try {
      setSteps(journeySteps[type] || []);
      // For other journeys, fetch from API
      const data = await fetchJourneyData(type);
      setSteps(data['view-pin']);

      setJourneyType(type);
      setIsGuided(true);
      setStepIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error starting journey:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const endJourney = () => {
    console.log('endJourney');
    setIsGuided(false);
    setJourneyType(null);
    setStepIndex(0);
    setSteps([]);
    setError(null);
  };

  const markTourComplete = () => {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    setHasTakenTour(true);
  };

  return (
    <GuidedJourneyContext.Provider
      value={{
        isGuided,
        stepIndex,
        journeyType,
        steps,
        hasTakenTour,
        isLoading,
        error,
        startJourney,
        endJourney,
        setStepIndex,
        markTourComplete
      }}
    >
      {children}
    </GuidedJourneyContext.Provider>
  );
};

export const useGuidedJourney = () => {
  const context = useContext(GuidedJourneyContext);
  if (context === undefined) {
    throw new Error('useGuidedJourney must be used within a GuidedJourneyProvider');
  }
  return context;
}; 