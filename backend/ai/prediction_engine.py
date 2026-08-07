import os
import joblib
import pandas as pd
import numpy as np
from typing import Dict

class PredictionEngine:
    """Singleton service to load ML models at startup and perform predictions"""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(PredictionEngine, cls).__new__(cls, *args, **kwargs)
            cls._instance._init_engine()
        return cls._instance

    def _init_engine(self):
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Paths
        self.energy_model_path = os.path.join(backend_dir, 'ml_models', 'energy_predictor.pkl')
        self.energy_scaler_path = os.path.join(backend_dir, 'ml_models', 'feature_scalers', 'energy_scaler.pkl')
        
        self.quality_model_path = os.path.join(backend_dir, 'ml_models', 'quality_predictor.pkl')
        self.quality_scaler_path = os.path.join(backend_dir, 'ml_models', 'feature_scalers', 'quality_scaler.pkl')
        
        self.anomaly_model_path = os.path.join(backend_dir, 'ml_models', 'anomaly_detector.pkl')

        # Load models
        self.energy_model = self._load_pkl(self.energy_model_path)
        self.energy_scaler = self._load_pkl(self.energy_scaler_path)
        
        self.quality_model = self._load_pkl(self.quality_model_path)
        self.quality_scaler = self._load_pkl(self.quality_scaler_path)
        
        self.anomaly_model = self._load_pkl(self.anomaly_model_path)

        print(f"Prediction Engine Loaded Models status:")
        print(f"  Energy Model: {'Loaded' if self.energy_model else 'Failed/Fallback'}")
        print(f"  Quality Model: {'Loaded' if self.quality_model else 'Failed/Fallback'}")
        print(f"  Anomaly Model: {'Loaded' if self.anomaly_model else 'Failed/Fallback'}")

    def _load_pkl(self, path):
        try:
            if os.path.exists(path):
                return joblib.load(path)
        except Exception as e:
            print(f"Error loading pkl at {path}: {e}")
        return None

    def predict_energy(self, lagging_reactive: float, leading_reactive: float, co2: float, 
                       lagging_pf: float, leading_pf: float, nsm: float) -> float:
        """Predict energy consumption in kWh"""
        if self.energy_model and self.energy_scaler:
            try:
                features = [[lagging_reactive, leading_reactive, co2, lagging_pf, leading_pf, nsm]]
                scaled_features = self.energy_scaler.transform(features)
                return float(self.energy_model.predict(scaled_features)[0])
            except Exception as e:
                print(f"Energy prediction failed: {e}. Falling back to default.")
        
        # Heuristic fallback: base load around 40-70 kWh depending on reactive power
        return 45.0 + (lagging_reactive * 0.1)

    def predict_quality_score(self, plate_features: Dict[str, float]) -> float:
        """Predict steel plate quality score (0 to 100)"""
        if self.quality_model and self.quality_scaler:
            try:
                # Reconstruct expected features in order
                feature_order = self.quality_model.feature_names_in_
                row = [plate_features.get(f, 0.0) for f in feature_order]
                scaled = self.quality_scaler.transform([row])
                return float(self.quality_model.predict(scaled)[0])
            except Exception as e:
                pass
        
        # Fallback quality score
        return 92.5

    def predict_anomaly_prob(self, plate_features: Dict[str, float]) -> float:
        """Predict anomaly/defect probability (0.0 to 1.0)"""
        if self.anomaly_model and self.quality_scaler:
            try:
                feature_order = self.anomaly_model.feature_names_in_
                row = [plate_features.get(f, 0.0) for f in feature_order]
                scaled = self.quality_scaler.transform([row])
                probs = self.anomaly_model.predict_proba(scaled)[0]
                return float(probs[1]) # Probability of class 1 (anomaly)
            except Exception as e:
                pass
        
        # Fallback anomaly probability
        return 0.05

# Instantiate engine singleton
prediction_engine = PredictionEngine()
