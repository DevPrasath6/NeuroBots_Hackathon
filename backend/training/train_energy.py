import os
import sys
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

# Add backend root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from training.preprocess import clean_and_scale_data

def train_energy_model():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(backend_dir, 'datasets', 'steel_industry_energy.csv')
    
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}")
        return

    print("Loading steel energy dataset...")
    df = pd.read_csv(dataset_path)
    
    # Define features and target
    feature_cols = [
        'Lagging_Current_Reactive.Power_kVarh',
        'Leading_Current_Reactive_Power_kVarh',
        'CO2(tCO2)',
        'Lagging_Current_Power_Factor',
        'Leading_Current_Power_Factor',
        'NSM'
    ]
    target_col = 'Usage_kWh'

    # Preprocess & Scale
    scaler_path = os.path.join(backend_dir, 'ml_models', 'feature_scalers', 'energy_scaler.pkl')
    X_scaled, scaler = clean_and_scale_data(df, feature_cols, scaler_path)
    y = df[target_col].fillna(df[target_col].mean())

    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

    print("Training energy consumption regressor...")
    model = RandomForestRegressor(n_estimators=50, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"Energy Predictor Trained Successfully.")
    print(f"  MAE: {mae:.4f} kWh")
    print(f"  R² Score: {r2*100:.2f}%")

    # Save model
    model_path = os.path.join(backend_dir, 'ml_models', 'energy_predictor.pkl')
    joblib.dump(model, model_path)
    print(f"Saved energy model to {model_path}")

    # Save metrics metadata
    metadata = {
        'trained_at': pd.Timestamp.now().isoformat(),
        'samples': len(df),
        'mae': float(mae),
        'r2': float(r2)
    }
    metadata_path = os.path.join(backend_dir, 'ml_models', 'energy_metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print(f"Saved metadata to {metadata_path}")

if __name__ == '__main__':
    train_energy_model()
