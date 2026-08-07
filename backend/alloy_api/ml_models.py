"""
Machine Learning models for alloy optimization
Implements trained ML models for material recommendation and quantity prediction
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
import joblib
import os
from typing import Dict, List, Tuple
from datetime import datetime


class AlloyMLModel:
    """
    Machine Learning model for alloy recommendations
    Uses Random Forest for material selection and quantity prediction
    """

    def __init__(self, model_dir: str = None):
        """
        Initialize the ML model

        Args:
            model_dir: Directory to save/load models. Defaults to backend/ml_models/
        """
        if model_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(base_dir, 'ml_models')

        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

        # Model components
        self.material_classifier = None  # Predicts which material to use
        self.quantity_regressor = None   # Predicts quantity needed
        self.scaler = None               # Feature scaler

        # Material mappings
        self.materials = [
            'FeSi 75%', 'FeCr 65%', 'Ni Metal',
            'FeMo 60%', 'Mn Metal', 'SiMn 65/15'
        ]
        self.material_to_idx = {mat: idx for idx, mat in enumerate(self.materials)}

        # Material compositions (element: percentage)
        self.material_compositions = {
            'FeSi 75%': {'Si': 75.0, 'Fe': 25.0},
            'FeCr 65%': {'Cr': 65.0, 'Fe': 35.0},
            'Ni Metal': {'Ni': 99.5, 'Fe': 0.5},
            'FeMo 60%': {'Mo': 60.0, 'Fe': 40.0},
            'Mn Metal': {'Mn': 99.0, 'Fe': 1.0},
            'SiMn 65/15': {'Mn': 65.0, 'Si': 15.0, 'Fe': 20.0}
        }

        # Track model metadata
        self.metadata = {
            'trained_at': None,
            'training_samples': 0,
            'classifier_accuracy': 0.0,
            'regressor_mae': 0.0,
            'regressor_r2': 0.0
        }

    def generate_training_data(self, n_samples: int = 10000) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Generate synthetic training data based on metallurgical principles

        Args:
            n_samples: Number of training samples to generate

        Returns:
            Tuple of (features_df, material_labels_df, quantity_labels_df)
        """
        np.random.seed(42)

        data = []
        material_labels = []
        quantity_labels = []

        # Common steel elements and their typical ranges
        elements = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'Mo', 'Fe']

        for _ in range(n_samples):
            # Generate current composition (typical steel ranges)
            current_comp = {
                'C': np.random.uniform(0.05, 4.0),
                'Si': np.random.uniform(0.1, 3.0),
                'Mn': np.random.uniform(0.2, 2.0),
                'Cr': np.random.uniform(0.0, 20.0),
                'Ni': np.random.uniform(0.0, 15.0),
                'Mo': np.random.uniform(0.0, 3.0),
                'Fe': 100.0  # Balance
            }

            # Generate target composition (small deviations)
            target_comp = {}
            element_to_adjust = np.random.choice(['Si', 'Mn', 'Cr', 'Ni', 'Mo'])

            for elem in elements:
                if elem == element_to_adjust:
                    # Need to increase this element
                    adjustment = np.random.uniform(0.1, 2.0)
                    target_comp[elem] = current_comp[elem] + adjustment
                else:
                    target_comp[elem] = current_comp[elem]

            # Calculate deviations
            deviations = {elem: target_comp[elem] - current_comp[elem] for elem in elements}

            # Determine optimal material based on metallurgical logic
            material, quantity = self._determine_optimal_material(
                element_to_adjust, deviations[element_to_adjust], current_comp
            )

            # Create feature vector
            feature_vec = {
                f'current_{elem}': current_comp[elem] for elem in elements
            }
            feature_vec.update({
                f'target_{elem}': target_comp[elem] for elem in elements
            })
            feature_vec.update({
                f'deviation_{elem}': deviations[elem] for elem in elements
            })
            feature_vec['primary_element'] = element_to_adjust
            feature_vec['deviation_magnitude'] = abs(deviations[element_to_adjust])
            feature_vec['heat_size'] = np.random.uniform(50, 500)  # tons

            data.append(feature_vec)
            material_labels.append(self.material_to_idx[material])
            quantity_labels.append(quantity)

        # Convert to DataFrames
        features_df = pd.DataFrame(data)

        # Encode categorical feature (primary_element)
        features_df = pd.get_dummies(features_df, columns=['primary_element'])

        material_labels_df = pd.Series(material_labels, name='material')
        quantity_labels_df = pd.Series(quantity_labels, name='quantity')

        return features_df, material_labels_df, quantity_labels_df

    def _determine_optimal_material(self, element: str, deviation: float,
                                   current_comp: Dict[str, float]) -> Tuple[str, float]:
        """
        Determine optimal material and quantity based on metallurgical principles

        Args:
            element: Element that needs adjustment
            deviation: Required change in element percentage
            current_comp: Current composition

        Returns:
            Tuple of (material_name, quantity_in_kg)
        """
        # Find materials that contain the target element
        candidate_materials = []
        for material, composition in self.material_compositions.items():
            if element in composition and composition[element] > 30:
                candidate_materials.append((material, composition[element]))

        if not candidate_materials:
            # Fallback
            return 'FeSi 75%', abs(deviation) * 10

        # Select material with highest element concentration (most efficient)
        material, element_pct = max(candidate_materials, key=lambda x: x[1])

        # Calculate quantity needed (simplified stoichiometry)
        # Assume 100 tons heat size for training
        heat_size = 100.0  # tons
        quantity_needed = (deviation / 100.0) * heat_size * (100.0 / element_pct)
        quantity_needed = abs(quantity_needed) * 1000  # Convert to kg

        # Add some realistic noise
        quantity_needed *= np.random.uniform(0.95, 1.05)

        # Clamp to reasonable range
        quantity_needed = np.clip(quantity_needed, 1.0, 5000.0)

        return material, quantity_needed

    def train(self, n_samples: int = 10000, test_size: float = 0.2) -> Dict:
        """
        Train the ML models on generated data

        Args:
            n_samples: Number of training samples
            test_size: Fraction of data for testing

        Returns:
            Dictionary with training metrics
        """
        print(f"Generating {n_samples} training samples...")
        X, y_material, y_quantity = self.generate_training_data(n_samples)

        # Split data
        X_train, X_test, y_mat_train, y_mat_test, y_qty_train, y_qty_test = train_test_split(
            X, y_material, y_quantity, test_size=test_size, random_state=42
        )

        # Scale features
        print("Scaling features...")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train material classifier
        print("Training material classifier...")
        self.material_classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=20,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        self.material_classifier.fit(X_train_scaled, y_mat_train)

        # Evaluate classifier
        y_mat_pred = self.material_classifier.predict(X_test_scaled)
        classifier_accuracy = accuracy_score(y_mat_test, y_mat_pred)

        # Train quantity regressor
        print("Training quantity regressor...")
        self.quantity_regressor = RandomForestRegressor(
            n_estimators=100,
            max_depth=20,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        self.quantity_regressor.fit(X_train_scaled, y_qty_train)

        # Evaluate regressor
        y_qty_pred = self.quantity_regressor.predict(X_test_scaled)
        regressor_mae = mean_absolute_error(y_qty_test, y_qty_pred)
        regressor_r2 = r2_score(y_qty_test, y_qty_pred)

        # Update metadata
        self.metadata = {
            'trained_at': datetime.now().isoformat(),
            'training_samples': n_samples,
            'classifier_accuracy': float(classifier_accuracy),
            'regressor_mae': float(regressor_mae),
            'regressor_r2': float(regressor_r2),
            'feature_names': list(X.columns)
        }

        print(f"\nTraining complete!")
        print(f"Material Classifier Accuracy: {classifier_accuracy:.3f}")
        print(f"Quantity Regressor MAE: {regressor_mae:.2f} kg")
        print(f"Quantity Regressor R²: {regressor_r2:.3f}")

        return self.metadata

    def predict(self, target_composition: Dict[str, float],
                current_composition: Dict[str, float],
                heat_size: float = 100.0) -> List[Dict]:
        """
        Predict alloy recommendations using trained ML models

        Args:
            target_composition: Target element percentages
            current_composition: Current element percentages
            heat_size: Heat size in tons

        Returns:
            List of recommendations with material, quantity, and confidence
        """
        if self.material_classifier is None or self.quantity_regressor is None:
            raise ValueError("Models not trained. Call train() or load() first.")

        recommendations = []

        # All elements we track
        all_elements = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'Mo', 'Fe']

        # Calculate deviations for all elements
        deviations = {}
        for elem in all_elements:
            target_val = target_composition.get(elem, current_composition.get(elem, 0.0))
            current_val = current_composition.get(elem, 0.0)
            deviations[elem] = target_val - current_val

        # Find elements that need significant adjustment
        significant_deviations = {
            elem: dev for elem, dev in deviations.items()
            if abs(dev) > 0.01 and elem != 'Fe'
        }

        for element, deviation in significant_deviations.items():
            # Prepare features
            feature_dict = {}

            for elem in all_elements:
                feature_dict[f'current_{elem}'] = current_composition.get(elem, 0.0)
                feature_dict[f'target_{elem}'] = target_composition.get(elem, current_composition.get(elem, 0.0))
                feature_dict[f'deviation_{elem}'] = deviations[elem]

            feature_dict['deviation_magnitude'] = abs(deviation)
            feature_dict['heat_size'] = heat_size

            # One-hot encode primary_element
            for elem in all_elements:
                if elem != 'Fe':
                    feature_dict[f'primary_element_{elem}'] = 1 if elem == element else 0

            # Convert to DataFrame with correct column order
            if 'feature_names' in self.metadata:
                feature_df = pd.DataFrame([feature_dict])
                # Ensure columns match training
                for col in self.metadata['feature_names']:
                    if col not in feature_df.columns:
                        feature_df[col] = 0
                feature_df = feature_df[self.metadata['feature_names']]
            else:
                feature_df = pd.DataFrame([feature_dict])

            # Scale features
            feature_scaled = self.scaler.transform(feature_df)

            # Predict material
            material_idx = self.material_classifier.predict(feature_scaled)[0]
            material_proba = self.material_classifier.predict_proba(feature_scaled)[0]
            material_name = self.materials[material_idx]
            confidence = float(material_proba[material_idx] * 100)

            # Predict quantity
            quantity = self.quantity_regressor.predict(feature_scaled)[0]
            quantity = max(1.0, float(quantity))  # Ensure positive

            # Calculate expected improvement
            material_comp = self.material_compositions[material_name]
            element_pct = material_comp.get(element, 0.0)
            expected_change = (quantity / 1000.0) * (element_pct / 100.0) / heat_size

            recommendations.append({
                'material': material_name,
                'quantity': round(quantity, 2),
                'element': element,
                'current': current_composition.get(element, 0.0),
                'target': target_composition.get(element, 0.0),
                'confidence': round(confidence, 1),
                'expected_change': round(expected_change, 4),
                'reason': f'ML model predicts {material_name} for {element} adjustment (confidence: {confidence:.1f}%)'
            })

        # Sort by confidence and return top 5
        recommendations.sort(key=lambda x: x['confidence'], reverse=True)
        return recommendations[:5]

    def save_models(self, version: str = 'latest'):
        """
        Save trained models to disk

        Args:
            version: Model version identifier
        """
        if self.material_classifier is None or self.quantity_regressor is None:
            raise ValueError("No trained models to save")

        version_dir = os.path.join(self.model_dir, version)
        os.makedirs(version_dir, exist_ok=True)

        joblib.dump(self.material_classifier, os.path.join(version_dir, 'material_classifier.pkl'))
        joblib.dump(self.quantity_regressor, os.path.join(version_dir, 'quantity_regressor.pkl'))
        joblib.dump(self.scaler, os.path.join(version_dir, 'scaler.pkl'))
        joblib.dump(self.metadata, os.path.join(version_dir, 'metadata.pkl'))

        print(f"Models saved to {version_dir}")

    def load_models(self, version: str = 'latest'):
        """
        Load trained models from disk

        Args:
            version: Model version identifier
        """
        version_dir = os.path.join(self.model_dir, version)

        if not os.path.exists(version_dir):
            raise FileNotFoundError(f"Model version '{version}' not found at {version_dir}")

        self.material_classifier = joblib.load(os.path.join(version_dir, 'material_classifier.pkl'))
        self.quantity_regressor = joblib.load(os.path.join(version_dir, 'quantity_regressor.pkl'))
        self.scaler = joblib.load(os.path.join(version_dir, 'scaler.pkl'))
        self.metadata = joblib.load(os.path.join(version_dir, 'metadata.pkl'))

        print(f"Models loaded from {version_dir}")
        print(f"Trained at: {self.metadata.get('trained_at', 'Unknown')}")
        print(f"Accuracy: {self.metadata.get('classifier_accuracy', 0):.3f}")


# Global model instance
_global_model = None


def get_model() -> AlloyMLModel:
    """Get or create the global model instance"""
    global _global_model
    if _global_model is None:
        _global_model = AlloyMLModel()
        try:
            _global_model.load_models()
            print("Loaded existing ML model")
        except FileNotFoundError:
            print("No trained model found. Train the model using: python manage.py train_ml_model")
    return _global_model
