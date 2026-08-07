import os
import sys
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score

# Add backend root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from training.preprocess import clean_and_scale_data

def train_quality_and_anomaly_models():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(backend_dir, 'datasets', 'steel_plates_faults.csv')
    
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}")
        return

    print("Loading steel plates faults dataset...")
    df = pd.read_csv(dataset_path)

    # Defect column targets
    target_cols = ['Pastry', 'Z_Scratch', 'K_Scatch', 'Stains', 'Dirtiness', 'Bumps', 'Other_Faults']
    
    # Feature columns (all columns except the targets)
    feature_cols = [col for col in df.columns if col not in target_cols]

    # Preprocess & Scale
    scaler_path = os.path.join(backend_dir, 'ml_models', 'feature_scalers', 'quality_scaler.pkl')
    X_scaled, scaler = clean_and_scale_data(df, feature_cols, scaler_path)

    # Anomaly indicator: 1 if any fault column is 1, else 0
    y_anomaly = (df[target_cols].sum(axis=1) > 0).astype(int)

    # Quality score: starts at 100, penalized by number of faults
    # If no faults, score is 100. If any faults, quality drops to 60-80 depending on area/thickness
    y_quality = 100.0 - (df[target_cols].sum(axis=1) * 20.0)
    # Add a bit of thickness-based variations to make it realistic
    if 'Steel_Plate_Thickness' in df.columns:
        y_quality = y_quality - (df['Steel_Plate_Thickness'] * 0.05)
    y_quality = np.clip(y_quality, 20.0, 100.0)

    # 1. Train Anomaly Detector (Classifier)
    X_train_a, X_test_a, y_train_a, y_test_a = train_test_split(X_scaled, y_anomaly, test_size=0.2, random_state=42)
    print("Training anomaly detector classifier...")
    anomaly_model = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42, n_jobs=-1)
    anomaly_model.fit(X_train_a, y_train_a)
    
    y_pred_a = anomaly_model.predict(X_test_a)
    acc = accuracy_score(y_test_a, y_pred_a)
    f1 = f1_score(y_test_a, y_pred_a)
    print(f"Anomaly Detector Trained. Accuracy: {acc*100:.2f}%, F1: {f1:.4f}")

    # 2. Train Quality Predictor (Regressor)
    X_train_q, X_test_q, y_train_q, y_test_q = train_test_split(X_scaled, y_quality, test_size=0.2, random_state=42)
    print("Training quality regressor...")
    quality_model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42, n_jobs=-1)
    quality_model.fit(X_train_q, y_train_q)

    y_pred_q = quality_model.predict(X_test_q)
    mae = mean_absolute_error(y_test_q, y_pred_q)
    r2 = r2_score(y_test_q, y_pred_q)
    print(f"Quality Predictor Trained. MAE: {mae:.4f}, R²: {r2*100:.2f}%")

    # Save models
    anomaly_path = os.path.join(backend_dir, 'ml_models', 'anomaly_detector.pkl')
    quality_path = os.path.join(backend_dir, 'ml_models', 'quality_predictor.pkl')
    joblib.dump(anomaly_model, anomaly_path)
    joblib.dump(quality_model, quality_path)
    print("Saved anomaly detector and quality models.")

    # Save metadata
    metadata = {
        'trained_at': pd.Timestamp.now().isoformat(),
        'samples': len(df),
        'anomaly_accuracy': float(acc),
        'anomaly_f1': float(f1),
        'quality_mae': float(mae),
        'quality_r2': float(r2)
    }
    metadata_path = os.path.join(backend_dir, 'ml_models', 'quality_metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print("Saved quality metadata.")

if __name__ == '__main__':
    train_quality_and_anomaly_models()
