import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib
import os

def clean_and_scale_data(df: pd.DataFrame, feature_cols: list, scaler_path: str = None) -> tuple:
    """Impute missing values and scale features using StandardScaler"""
    # Fill missing values
    df_clean = df.copy()
    for col in feature_cols:
        if col in df_clean.columns:
            if df_clean[col].dtype in [np.float64, np.int64]:
                df_clean[col] = df_clean[col].fillna(df_clean[col].mean())
            else:
                df_clean[col] = df_clean[col].fillna(df_clean[col].mode()[0] if not df_clean[col].mode().empty else '')

    X = df_clean[feature_cols]
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=feature_cols)

    # Save scaler if path is provided
    if scaler_path:
        os.makedirs(os.path.dirname(scaler_path), exist_ok=True)
        joblib.dump(scaler, scaler_path)
        print(f"Saved scaler to {scaler_path}")

    return X_scaled_df, scaler
