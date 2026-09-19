import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type {
  AgentPlanRequest,
  HealthResponse,
  OperationalPlan,
  ScenarioInput,
  SimulationResponse,
} from '../types/api';

export type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: string };

export type LayerKey = 'risk' | 'fire' | 'spread' | 'wind' | 'assets';

export const DEFAULT_SCENARIO: ScenarioInput = {
  hour: 3,
  wind_speed: 41,
  wind_direction: 68,
  temperature: 39,
  humidity: 14,
  hotspot_active: true,
  hotspot_x: 25,
  hotspot_y: 58,
};

const CRITICAL_SCENARIO: ScenarioInput = {
  hour: 4,
  wind_speed: 52,
  wind_direction: 69,
  temperature: 41,
  humidity: 11,
  hotspot_active: true,
  hotspot_x: 25,
  hotspot_y: 58,
};

const empty = <T,>(): AsyncState<T> => ({ status: 'idle', data: null, error: null });

export function useDashboard() {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [simulation, setSimulation] = useState<AsyncState<SimulationResponse>>(empty);
  const [health, setHealth] = useState<AsyncState<HealthResponse>>(empty);
  const [plan, setPlan] = useState<AsyncState<OperationalPlan>>(empty);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    risk: true, fire: true, spread: true, wind: true, assets: true,
  });
  const [baseMap, setBaseMap] = useState<'satellite' | 'street'>('satellite');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('solar');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; message: string } | null>(null);
  const simulationAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setHealth({ status: 'loading', data: null, error: null });
    apiClient.health(controller.signal).then(
      (data) => setHealth({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setHealth({ status: 'error', data: null, error: getErrorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    simulationAbort.current?.abort();
    const controller = new AbortController();
    simulationAbort.current = controller;
    setSimulation((current) => ({ status: 'loading', data: current.data, error: null }));
    apiClient.simulate(scenario, controller.signal).then(
      (data) => setSimulation({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setSimulation((current) => ({ status: 'error', data: current.data, error: getErrorMessage(error) }));
          setNotice({ tone: 'error', message: `No se pudo actualizar el escenario: ${getErrorMessage(error)}` });
        }
      },
    );
    return () => controller.abort();
  }, [scenario]);

  const updateScenario = useCallback((change: Partial<ScenarioInput>) => {
    setScenario((current) => ({ ...current, ...change }));
  }, []);

  const activateCriticalScenario = useCallback(() => {
    setScenario(CRITICAL_SCENARIO);
    setNotice({ tone: 'info', message: 'Escenario crítico activado' });
  }, []);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const weather = await apiClient.weather(39.7178, -6.2631);
      setScenario((current) => ({
        ...current,
        hour: 0,
        temperature: weather.temperature,
        humidity: weather.humidity,
        wind_speed: weather.wind_speed,
        wind_direction: weather.wind_direction,
      }));
      setNotice({ tone: 'success', message: `Meteorología actualizada · ${weather.time.slice(11, 16)}` });
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const generatePlan = useCallback(async () => {
    if (!simulation.data || plan.status === 'loading') return;
    const request: AgentPlanRequest = {
      incident: {
        type: 'wildfire', location: 'Talaván Norte', temperature: scenario.temperature,
        humidity: scenario.humidity, wind_speed: scenario.wind_speed,
        wind_direction: scenario.wind_direction, horizon_hours: scenario.hour,
        top_eta_min: simulation.data.metrics.top_eta_min,
        territorial_risk: simulation.data.metrics.territorial_risk,
      },
      assets: simulation.data.assets.map((asset) => ({
        id: asset.id, name: asset.name, lat: asset.lat, lng: asset.lng,
        value_eur: asset.value_eur, people: asset.people, probability: asset.probability,
      })),
    };
    setPlan((current) => ({ status: 'loading', data: current.data, error: null }));
    try {
      const data = await apiClient.generatePlan(request);
      setPlan({ status: 'success', data, error: null });
      setNotice({ tone: 'success', message: 'Plan operativo actualizado' });
    } catch (error) {
      setPlan((current) => ({ status: 'error', data: current.data, error: getErrorMessage(error) }));
    }
  }, [plan.status, scenario, simulation.data]);

  const toggleLayer = useCallback((layer: LayerKey) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }, []);

  return useMemo(() => ({
    scenario, simulation, health, plan, weatherLoading, layers, baseMap,
    selectedAssetId, notice, updateScenario, activateCriticalScenario,
    loadWeather, generatePlan, toggleLayer, setBaseMap, setSelectedAssetId,
    dismissNotice: () => setNotice(null),
  }), [
    scenario, simulation, health, plan, weatherLoading, layers, baseMap,
    selectedAssetId, notice, updateScenario, activateCriticalScenario,
    loadWeather, generatePlan, toggleLayer,
  ]);
}

