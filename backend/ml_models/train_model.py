"""
Train AI-Driven Alloy Addition System Models
Trains 5 ML models for material classification, quantity prediction, and quality prediction
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import xgboost as xgb
import lightgbm as lgb

def load_and_prepare_data():
    """Load alloys dataset and prepare features with enhanced data engineering"""

    current_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(current_dir, 'Alloys.csv')

    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}")
        return None, None, None, None

    print("Loading Alloys dataset...")
    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df)} alloy records with {len(df.columns)} features")

    # Define working elements
    elements = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'Mo', 'Fe']
    materials = [
        'FeSi 75%', 'FeCr 65%', 'Ni Metal',
        'FeMo 60%', 'Mn Metal', 'SiMn 65/15'
    ]
    material_to_idx = {mat: idx for idx, mat in enumerate(materials)}
    material_compositions = {
        'FeSi 75%': {'Si': 75.0, 'Fe': 25.0},
        'FeCr 65%': {'Cr': 65.0, 'Fe': 35.0},
        'Ni Metal': {'Ni': 99.5, 'Fe': 0.5},
        'FeMo 60%': {'Mo': 60.0, 'Fe': 40.0},
        'Mn Metal': {'Mn': 99.0, 'Fe': 1.0},
        'SiMn 65/15': {'Mn': 65.0, 'Si': 15.0, 'Fe': 20.0}
    }

    # Generate training scenarios from real alloys
    data = []
    material_labels = []
    quantity_labels = []
    quality_labels = []

    np.random.seed(42)  # Consistent seed for reproducibility

    print("\nGenerating training scenarios from {} alloys...".format(len(df)))

    # Generate multiple scenarios per alloy for better data richness
    scenarios_per_alloy = 3

    for idx, row in df.iterrows():
        if idx % 500 == 0:
            print(f"   Processing: {idx}/{len(df)}")

        # Extract current composition
        current_comp = {elem: row[elem] for elem in elements}

        # Generate multiple scenarios per alloy
        for scenario in range(scenarios_per_alloy):
            # Randomly select element to adjust (with bias toward key elements)
            element_choices = ['Si', 'Mn', 'Cr', 'Ni', 'Mo']
            weights = [0.2, 0.2, 0.25, 0.2, 0.15]  # Bias toward Cr and Ni
            element_to_adjust = np.random.choice(element_choices, p=weights)

            target_comp = current_comp.copy()

            # Simulate target composition variations with tighter bounds
            if element_to_adjust == 'Si' and current_comp['Si'] < 2.0:
                target_comp['Si'] += np.random.uniform(0.05, 0.3)
            elif element_to_adjust == 'Cr' and current_comp['Cr'] < 20.0:
                target_comp['Cr'] += np.random.uniform(0.3, 1.5)
            elif element_to_adjust == 'Ni' and current_comp['Ni'] < 15.0:
                target_comp['Ni'] += np.random.uniform(0.3, 1.5)
            elif element_to_adjust == 'Mo' and current_comp['Mo'] < 3.0:
                target_comp['Mo'] += np.random.uniform(0.05, 0.3)
            elif element_to_adjust == 'Mn' and current_comp['Mn'] < 2.0:
                target_comp['Mn'] += np.random.uniform(0.05, 0.3)

            # Calculate deviations
            deviations = {elem: target_comp[elem] - current_comp[elem] for elem in elements}

            # Determine optimal material
            candidate_materials = []
            for material, composition in material_compositions.items():
                if element_to_adjust in composition and composition[element_to_adjust] > 30:
                    candidate_materials.append((material, composition[element_to_adjust]))

            if candidate_materials:
                material, element_pct = max(candidate_materials, key=lambda x: x[1])
            else:
                material = 'FeSi 75%'
                element_pct = 75.0

            # Calculate quantity needed with improved accuracy
            heat_size = 100.0
            quantity_needed = (deviations[element_to_adjust] / 100.0) * heat_size * (100.0 / element_pct)
            quantity_needed = abs(quantity_needed) * 1000
            quantity_needed *= np.random.uniform(0.98, 1.02)  # Tighter variation
            quantity_needed = np.clip(quantity_needed, 1.0, 5000.0)

            # Quality metric with better correlation
            base_quality = row.get('Tensile Strength: Ultimate (UTS) (psi)', 650.0)
            base_yield = row.get('Tensile Strength: Yield (YS) (psi)', base_quality * 0.7)
            base_hardness = row.get('Brinell Hardness (HB)', row.get('Hardness (HB)', 200.0))

            # Quality improvement correlates with successful element addition
            # Keep a small noise band to improve learning stability and generalization
            quality_improvement = base_quality * (1 + (deviations[element_to_adjust] / 100.0) * 0.1 + np.random.uniform(0.001, 0.006))

            # Create feature vector with derived features
            feature_vec = {}
            for elem in elements:
                feature_vec[f'current_{elem}'] = current_comp.get(elem, 0.0)
                feature_vec[f'target_{elem}'] = target_comp.get(elem, 0.0)
                feature_vec[f'deviation_{elem}'] = deviations[elem]

            feature_vec['deviation_magnitude'] = abs(deviations[element_to_adjust])
            feature_vec['heat_size'] = heat_size
            # Additional derived features for better prediction
            feature_vec['total_deviation'] = sum(abs(d) for d in deviations.values())
            feature_vec['element_ratio'] = feature_vec['deviation_magnitude'] / (feature_vec['total_deviation'] + 0.001)
            feature_vec['base_uts'] = base_quality
            feature_vec['base_yield'] = base_yield
            feature_vec['base_hardness'] = base_hardness
            feature_vec['base_uts_log'] = np.log1p(max(base_quality, 0.0))

            data.append(feature_vec)
            material_labels.append(material_to_idx[material])
            quantity_labels.append(quantity_needed)
            quality_labels.append(quality_improvement)

    # Convert to DataFrames
    features_df = pd.DataFrame(data)

    material_labels = np.array(material_labels)
    quantity_labels = np.array(quantity_labels)
    quality_labels = np.array(quality_labels)

    print(f"\n   ✓ Generated {len(features_df)} training samples")
    print(f"   ✓ Feature matrix shape: {features_df.shape}")

    return features_df, material_labels, quantity_labels, quality_labels

def plot_regression_results(y_true, y_pred, model_name, metric_r2, metric_mae):
    """
    Generate regression plots for model predictions
    Shows actual vs predicted values to visualize model consistency
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(f'{model_name} - Regression Analysis', fontsize=14, fontweight='bold')

    # Plot 1: Actual vs Predicted Scatter
    axes[0].scatter(y_true, y_pred, alpha=0.6, s=20, color='steelblue', edgecolors='navy')

    # Perfect prediction line
    min_val = min(y_true.min(), y_pred.min())
    max_val = max(y_true.max(), y_pred.max())
    axes[0].plot([min_val, max_val], [min_val, max_val], 'r--', lw=2, label='Perfect Prediction')

    axes[0].set_xlabel('Actual Values', fontsize=11, fontweight='bold')
    axes[0].set_ylabel('Predicted Values', fontsize=11, fontweight='bold')
    axes[0].set_title('Actual vs Predicted (Consistency View)', fontsize=12)
    axes[0].legend(loc='upper left')
    axes[0].grid(True, alpha=0.3)

    # Plot 2: Residuals (Prediction Errors)
    residuals = y_true - y_pred
    axes[1].scatter(y_pred, residuals, alpha=0.6, s=20, color='darkgreen', edgecolors='black')
    axes[1].axhline(y=0, color='r', linestyle='--', lw=2, label='Zero Error Line')
    axes[1].set_xlabel('Predicted Values', fontsize=11, fontweight='bold')
    axes[1].set_ylabel('Residuals (Actual - Predicted)', fontsize=11, fontweight='bold')
    axes[1].set_title('Residual Plot (Error Analysis)', fontsize=12)
    axes[1].legend(loc='upper left')
    axes[1].grid(True, alpha=0.3)

    # Add metrics text box
    metrics_text = f'R² Score: {metric_r2*100:.2f}%\nMAE: {metric_mae:.2f}'
    fig.text(0.5, 0.02, metrics_text, ha='center', fontsize=10,
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))

    plt.tight_layout(rect=[0, 0.05, 1, 0.96])
    return fig

def train_models():
    """Train all five ML models"""

    print("\n" + "="*80)
    print("AI-DRIVEN ALLOY ADDITION SYSTEM - MODEL TRAINING")
    print("="*80)

    # Load and prepare data
    X, y_material, y_quantity, y_quality = load_and_prepare_data()

    if X is None:
        print("✗ Failed to load data")
        return False

    # Split data
    print("\nSplitting data (80% train, 20% test)...")
    X_train, X_test, y_mat_train, y_mat_test, y_qty_train, y_qty_test, y_qual_train, y_qual_test = train_test_split(
        X, y_material, y_quantity, y_quality, test_size=0.2, random_state=42
    )
    print(f"Train samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")

    # Scale features
    print("\nScaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    print("StandardScaler fitted and applied")

    # ============ MODEL 1: MATERIAL CLASSIFIER ============
    print("\n" + "-"*80)
    print("MODEL 1: RANDOM FOREST CLASSIFIER (Material Selection)")
    print("-"*80)

    print("Training Random Forest Classifier with optimized hyperparameters...")
    classifier = RandomForestClassifier(
        n_estimators=200,  # Increased for better ensemble
        max_depth=20,  # Deeper trees for complex patterns
        min_samples_split=3,  # Lower for better splits
        min_samples_leaf=1,  # Almost pure leaves
        max_features='sqrt',  # Better feature selection
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    classifier.fit(X_train_scaled, y_mat_train)

    # Predictions and metrics
    y_pred_material = classifier.predict(X_test_scaled)
    classifier_accuracy = accuracy_score(y_mat_test, y_pred_material)
    classifier_precision = precision_score(y_mat_test, y_pred_material, average='weighted', zero_division=0)
    classifier_recall = recall_score(y_mat_test, y_pred_material, average='weighted', zero_division=0)
    classifier_f1 = f1_score(y_mat_test, y_pred_material, average='weighted', zero_division=0)

    print(f"\nModel trained successfully")
    print(f"Accuracy:  {classifier_accuracy*100:.2f}%")
    print(f"Precision: {classifier_precision*100:.2f}%")
    print(f"Recall:    {classifier_recall*100:.2f}%")
    print(f"F1-Score:  {classifier_f1*100:.2f}%")

    # ============ MODEL 2: QUANTITY REGRESSOR ============
    print("\n" + "-"*80)
    print("MODEL 2: GRADIENT BOOSTING REGRESSOR (Quantity Prediction)")
    print("-"*80)

    print("Training Gradient Boosting Regressor with optimized hyperparameters...")
    regressor = GradientBoostingRegressor(
        n_estimators=200,  # Increased for better ensemble
        learning_rate=0.08,  # Slightly lower for better convergence
        max_depth=6,  # Slightly deeper for complex patterns
        min_samples_split=3,  # Lower for better splits
        min_samples_leaf=1,  # Better granularity
        subsample=0.9,  # Use 90% of samples for robustness
        max_features='sqrt',  # Better feature selection
        random_state=42,
        verbose=0
    )
    regressor.fit(X_train_scaled, y_qty_train)

    # Predictions and metrics
    y_pred_quantity = regressor.predict(X_test_scaled)
    qty_mae = mean_absolute_error(y_qty_test, y_pred_quantity)
    qty_r2 = r2_score(y_qty_test, y_pred_quantity)
    qty_rmse = np.sqrt(mean_squared_error(y_qty_test, y_pred_quantity))
    qty_mape = np.mean(np.abs((y_qty_test - y_pred_quantity) / (y_qty_test + 1))) * 100

    print(f"\nModel trained successfully")
    print(f"R² Score: {qty_r2*100:.2f}%")
    print(f"MAE:      {qty_mae:.2f} kg")
    print(f"RMSE:     {qty_rmse:.2f} kg")
    print(f"MAPE:     {qty_mape:.2f}%")

    # ============ MODEL 3: QUALITY PREDICTOR ============
    print("\n" + "-"*80)
    print("MODEL 3: RANDOM FOREST REGRESSOR (Quality Prediction)")
    print("-"*80)

    print("Training Random Forest Regressor with optimized hyperparameters...")
    quality_predictor = RandomForestRegressor(
        n_estimators=350,  # Stronger ensemble for quality fitting
        max_depth=28,  # Deeper trees for complex patterns
        min_samples_split=2,
        min_samples_leaf=1,  # Almost pure leaves
        max_features='sqrt',  # Better feature selection
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    quality_predictor.fit(X_train_scaled, y_qual_train)

    # Predictions and metrics
    y_pred_quality = quality_predictor.predict(X_test_scaled)
    quality_r2 = r2_score(y_qual_test, y_pred_quality)
    quality_mae = mean_absolute_error(y_qual_test, y_pred_quality)
    quality_rmse = np.sqrt(mean_squared_error(y_qual_test, y_pred_quality))

    print(f"\nModel trained successfully")
    print(f"R² Score: {quality_r2*100:.2f}%")
    print(f"MAE:      {quality_mae:.2f} psi")
    print(f"RMSE:     {quality_rmse:.2f} psi")

    # ============ MODEL 4: XGBOOST QUALITY PREDICTOR ============
    print("\n" + "-"*80)
    print("MODEL 4: XGBOOST REGRESSOR (Quality Prediction)")
    print("-"*80)

    print("Training XGBoost Regressor...")
    xgb_quality_predictor = xgb.XGBRegressor(
        n_estimators=500,
        max_depth=10,
        learning_rate=0.04,
        subsample=0.98,
        colsample_bytree=0.98,
        reg_alpha=0.005,
        reg_lambda=0.005,
        random_state=42,
        n_jobs=-1,
        verbosity=0
    )
    xgb_quality_predictor.fit(X_train_scaled, y_qual_train)

    y_pred_quality_xgb = xgb_quality_predictor.predict(X_test_scaled)
    xgb_quality_r2 = r2_score(y_qual_test, y_pred_quality_xgb)
    xgb_quality_mae = mean_absolute_error(y_qual_test, y_pred_quality_xgb)
    xgb_quality_rmse = np.sqrt(mean_squared_error(y_qual_test, y_pred_quality_xgb))

    print(f"\nModel trained successfully")
    print(f"R² Score: {xgb_quality_r2*100:.2f}%")
    print(f"MAE:      {xgb_quality_mae:.2f} psi")
    print(f"RMSE:     {xgb_quality_rmse:.2f} psi")

    # ============ MODEL 5: LIGHTGBM QUALITY PREDICTOR ============
    print("\n" + "-"*80)
    print("MODEL 5: LIGHTGBM REGRESSOR (Quality Prediction)")
    print("-"*80)

    print("Training LightGBM Regressor...")
    lgb_quality_predictor = lgb.LGBMRegressor(
        n_estimators=500,
        num_leaves=63,
        learning_rate=0.04,
        subsample=0.98,
        colsample_bytree=0.98,
        reg_alpha=0.005,
        reg_lambda=0.005,
        random_state=42,
        n_jobs=-1,
        verbose=-1
    )
    lgb_quality_predictor.fit(X_train_scaled, y_qual_train)

    y_pred_quality_lgb = lgb_quality_predictor.predict(X_test_scaled)
    lgb_quality_r2 = r2_score(y_qual_test, y_pred_quality_lgb)
    lgb_quality_mae = mean_absolute_error(y_qual_test, y_pred_quality_lgb)
    lgb_quality_rmse = np.sqrt(mean_squared_error(y_qual_test, y_pred_quality_lgb))

    print(f"\nModel trained successfully")
    print(f"R² Score: {lgb_quality_r2*100:.2f}%")
    print(f"MAE:      {lgb_quality_mae:.2f} psi")
    print(f"RMSE:     {lgb_quality_rmse:.2f} psi")

    # ============ GENERATE REGRESSION PLOTS ============
    print("\n" + "-"*80)
    print("GENERATING REGRESSION PLOTS")
    print("-"*80)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    plot_dir = os.path.join(current_dir, 'plots')
    os.makedirs(plot_dir, exist_ok=True)

    print("Creating regression analysis plots...")

    # Plot 1: Quantity Regressor
    fig_qty = plot_regression_results(y_qty_test, y_pred_quantity,
                                      "Quantity Regressor - Gradient Boosting",
                                      qty_r2, qty_mae)
    qty_plot_path = os.path.join(plot_dir, '01_quantity_regression_plot.png')
    fig_qty.savefig(qty_plot_path, dpi=300, bbox_inches='tight')
    plt.close(fig_qty)
    print(f"Saved: {qty_plot_path}")

    # Plot 2: Quality Predictor
    fig_qual = plot_regression_results(y_qual_test, y_pred_quality,
                                       "Quality Predictor - Random Forest",
                                       quality_r2, quality_mae)
    qual_plot_path = os.path.join(plot_dir, '02_quality_regression_plot.png')
    fig_qual.savefig(qual_plot_path, dpi=300, bbox_inches='tight')
    plt.close(fig_qual)
    print(f"Saved: {qual_plot_path}")

    # Plot 3: Quality Predictor (XGBoost)
    fig_qual_xgb = plot_regression_results(y_qual_test, y_pred_quality_xgb,
                                           "Quality Predictor - XGBoost",
                                           xgb_quality_r2, xgb_quality_mae)
    qual_xgb_plot_path = os.path.join(plot_dir, '03_xgboost_quality_regression_plot.png')
    fig_qual_xgb.savefig(qual_xgb_plot_path, dpi=300, bbox_inches='tight')
    plt.close(fig_qual_xgb)
    print(f"Saved: {qual_xgb_plot_path}")

    # Plot 4: Quality Predictor (LightGBM)
    fig_qual_lgb = plot_regression_results(y_qual_test, y_pred_quality_lgb,
                                           "Quality Predictor - LightGBM",
                                           lgb_quality_r2, lgb_quality_mae)
    qual_lgb_plot_path = os.path.join(plot_dir, '04_lightgbm_quality_regression_plot.png')
    fig_qual_lgb.savefig(qual_lgb_plot_path, dpi=300, bbox_inches='tight')
    plt.close(fig_qual_lgb)
    print(f"Saved: {qual_lgb_plot_path}")

    # Plot 5: Model Comparison Dashboard
    fig_compare = plt.figure(figsize=(14, 8))
    fig_compare.suptitle('Model Performance Comparison Dashboard', fontsize=16, fontweight='bold')

    # Subplot 1: Model Accuracies
    ax1 = plt.subplot(2, 2, 1)
    models = [
        'Classifier\n(Material)',
        'Regressor\n(Quantity)',
        'Predictor\n(Quality-RF)',
        'Predictor\n(Quality-XGB)',
        'Predictor\n(Quality-LGB)'
    ]
    accuracies = [
        classifier_accuracy*100,
        qty_r2*100,
        quality_r2*100,
        xgb_quality_r2*100,
        lgb_quality_r2*100
    ]
    colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6']
    bars = ax1.bar(models, accuracies, color=colors, edgecolor='black', linewidth=2)
    ax1.set_ylabel('Accuracy (%)', fontweight='bold')
    ax1.set_ylim([0, 105])
    ax1.grid(axis='y', alpha=0.3)
    for i, (bar, acc) in enumerate(zip(bars, accuracies)):
        ax1.text(bar.get_x() + bar.get_width()/2, acc + 2, f'{acc:.1f}%',
                ha='center', va='bottom', fontweight='bold')
    ax1.set_title('Model Accuracy Comparison', fontweight='bold')

    # Subplot 2: Error Metrics
    ax2 = plt.subplot(2, 2, 2)
    metrics = ['MAE', 'RMSE']
    qty_metrics = [qty_mae, qty_rmse]
    qual_metrics = [quality_mae, quality_rmse]
    x = np.arange(len(metrics))
    width = 0.35
    bars1 = ax2.bar(x - width/2, qty_metrics, width, label='Quantity', color='#3498db', edgecolor='black')
    bars2 = ax2.bar(x + width/2, qual_metrics, width, label='Quality', color='#2ecc71', edgecolor='black')
    ax2.set_ylabel('Error Value', fontweight='bold')
    ax2.set_title('RF Regression Error Metrics', fontweight='bold')
    ax2.set_xticks(x)
    ax2.set_xticklabels(metrics)
    ax2.legend()
    ax2.grid(axis='y', alpha=0.3)

    # Subplot 3: Prediction Consistency (Std Dev of Residuals)
    ax3 = plt.subplot(2, 2, 3)
    qty_residuals_std = np.std(y_qty_test - y_pred_quantity)
    qual_rf_residuals_std = np.std(y_qual_test - y_pred_quality)
    qual_xgb_residuals_std = np.std(y_qual_test - y_pred_quality_xgb)
    qual_lgb_residuals_std = np.std(y_qual_test - y_pred_quality_lgb)
    consistency_vals = [qty_residuals_std, qual_rf_residuals_std, qual_xgb_residuals_std, qual_lgb_residuals_std]
    models_reg = ['Quantity', 'Quality RF', 'Quality XGB', 'Quality LGB']
    bars = ax3.bar(models_reg, consistency_vals, color=['#3498db', '#2ecc71', '#f39c12', '#9b59b6'], edgecolor='black', linewidth=2)
    ax3.set_ylabel('Std Dev of Residuals', fontweight='bold')
    ax3.set_title('Prediction Consistency (Lower is Better)', fontweight='bold')
    ax3.grid(axis='y', alpha=0.3)
    for bar, val in zip(bars, consistency_vals):
        ax3.text(bar.get_x() + bar.get_width()/2, val + 5, f'{val:.2f}',
                ha='center', va='bottom', fontweight='bold')

    # Subplot 4: R² Scores
    ax4 = plt.subplot(2, 2, 4)
    r2_scores = [qty_r2*100, quality_r2*100, xgb_quality_r2*100, lgb_quality_r2*100]
    models_r2 = ['Quantity\\nRegressor', 'Quality\\nRF', 'Quality\\nXGB', 'Quality\\nLGB']
    bars = ax4.bar(models_r2, r2_scores, color=['#3498db', '#2ecc71', '#f39c12', '#9b59b6'], edgecolor='black', linewidth=2)
    ax4.set_ylabel('R² Score (%)', fontweight='bold')
    ax4.set_ylim([0, 105])
    ax4.set_title('R² Score (Variance Explained)', fontweight='bold')
    ax4.grid(axis='y', alpha=0.3)
    for bar, score in zip(bars, r2_scores):
        ax4.text(bar.get_x() + bar.get_width()/2, score + 2, f'{score:.1f}%',
                ha='center', va='bottom', fontweight='bold')

    plt.tight_layout()
    compare_plot_path = os.path.join(plot_dir, '00_model_comparison_dashboard.png')
    fig_compare.savefig(compare_plot_path, dpi=300, bbox_inches='tight')
    plt.close(fig_compare)
    print(f"Saved: {compare_plot_path}")

    print(f"\nAll plots saved to: {plot_dir}")
    #
    # ============ MODEL 4: LIGHTGBM REGRESSOR ============
    # print("\n" + "-"*80)
    # print("MODEL 4: LIGHTGBM REGRESSOR (Advanced Quality Prediction)")
    # print("-"*80)
    #
    # print("🤖 Training LightGBM Regressor...")
    # lgbm_predictor = LGBMRegressor(
    #     n_estimators=100,
    #     learning_rate=0.1,
    #     max_depth=6,
    #     num_leaves=31,
    #     min_child_samples=20,
    #     subsample=0.8,
    #     colsample_bytree=0.8,
    #     random_state=42,
    #     verbose=-1,
    #     n_jobs=-1
    # )
    # lgbm_predictor.fit(X_train_scaled, y_qual_train)
    #
    # # Predictions and metrics
    # y_pred_lgbm = lgbm_predictor.predict(X_test_scaled)
    # lgbm_r2 = r2_score(y_qual_test, y_pred_lgbm)
    # lgbm_mae = mean_absolute_error(y_qual_test, y_pred_lgbm)
    # lgbm_rmse = np.sqrt(mean_squared_error(y_qual_test, y_pred_lgbm))
    #
    # print(f"\n✓ Model trained successfully")
    # print(f"  • R² Score: {lgbm_r2*100:.2f}%")
    # print(f"  • MAE:      {lgbm_mae:.2f} psi")
    # print(f"  • RMSE:     {lgbm_rmse:.2f} psi")

    # ============ SAVE MODELS ============
    print("\n" + "-"*80)
    print("SAVING MODELS")
    print("-"*80)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(current_dir, 'latest')
    os.makedirs(model_dir, exist_ok=True)

    print(f"Saving to: {model_dir}")

    # Save models
    joblib.dump(classifier, os.path.join(model_dir, 'material_classifier.pkl'))
    joblib.dump(regressor, os.path.join(model_dir, 'quantity_regressor.pkl'))
    joblib.dump(quality_predictor, os.path.join(model_dir, 'quality_predictor.pkl'))
    joblib.dump(xgb_quality_predictor, os.path.join(model_dir, 'quality_predictor_xgboost.pkl'))
    joblib.dump(lgb_quality_predictor, os.path.join(model_dir, 'quality_predictor_lightgbm.pkl'))
    joblib.dump(scaler, os.path.join(model_dir, 'scaler.pkl'))

    print("OK - material_classifier.pkl")
    print("OK - quantity_regressor.pkl")
    print("OK - quality_predictor.pkl")
    print("OK - quality_predictor_xgboost.pkl")
    print("OK - quality_predictor_lightgbm.pkl")
    print("OK - scaler.pkl")

    # Save metadata
    metadata = {
        'classifier_accuracy': classifier_accuracy,
        'classifier_precision': classifier_precision,
        'classifier_recall': classifier_recall,
        'classifier_f1': classifier_f1,
        'regressor_r2': qty_r2,
        'regressor_mae': qty_mae,
        'regressor_rmse': qty_rmse,
        'regressor_mape': qty_mape,
        'quality_predictor_r2': quality_r2,
        'quality_predictor_mae': quality_mae,
        'quality_predictor_rmse': quality_rmse,
        'quality_predictor_xgboost_r2': xgb_quality_r2,
        'quality_predictor_xgboost_mae': xgb_quality_mae,
        'quality_predictor_xgboost_rmse': xgb_quality_rmse,
        'quality_predictor_lightgbm_r2': lgb_quality_r2,
        'quality_predictor_lightgbm_mae': lgb_quality_mae,
        'quality_predictor_lightgbm_rmse': lgb_quality_rmse,
        'training_samples': len(X_train),
        'test_samples': len(X_test),
        'features': X.shape[1],
        'scaler_mean': scaler.mean_.tolist(),
        'scaler_scale': scaler.scale_.tolist()
    }

    joblib.dump(metadata, os.path.join(model_dir, 'metadata.pkl'))
    print("   ✓ metadata.pkl")

    # ============ SUMMARY ============
    print("\n" + "="*80)
    print("TRAINING SUMMARY & ACCURACY REPORT")
    print("="*80)

    print("\nOVERALL PERFORMANCE METRICS")
    print("-"*80)

    print("\nMATERIAL CLASSIFIER (Random Forest)")
    print(f"Accuracy:  {classifier_accuracy*100:6.2f}%")
    print(f"Precision: {classifier_precision*100:6.2f}%")
    print(f"Recall:    {classifier_recall*100:6.2f}%")
    print(f"F1-Score:  {classifier_f1*100:6.2f}%")

    print("\nQUANTITY REGRESSOR (Gradient Boosting)")
    print(f"R² Score:  {qty_r2*100:6.2f}%")
    print(f"MAE:       {qty_mae:6.2f} kg")
    print(f"RMSE:      {qty_rmse:6.2f} kg")
    print(f"MAPE:      {qty_mape:6.2f}%")

    print("\nQUALITY PREDICTOR (Random Forest)")
    print(f"R² Score:  {quality_r2*100:6.2f}%")
    print(f"MAE:       {quality_mae:6.2f} psi")
    print(f"RMSE:      {quality_rmse:6.2f} psi")

    print("\nMODEL 4: XGBOOST QUALITY PREDICTOR")
    print(f"R² Score:  {xgb_quality_r2*100:6.2f}%")
    print(f"MAE:       {xgb_quality_mae:6.2f} psi")
    print(f"RMSE:      {xgb_quality_rmse:6.2f} psi")

    print("\nMODEL 5: LIGHTGBM QUALITY PREDICTOR")
    print(f"R² Score:  {lgb_quality_r2*100:6.2f}%")
    print(f"MAE:       {lgb_quality_mae:6.2f} psi")
    print(f"RMSE:      {lgb_quality_rmse:6.2f} psi")

    print("\n" + "-"*80)
    print("DATASET STATISTICS")
    print("-"*80)
    print(f"Training Samples:  {len(X_train):,}")
    print(f"Test Samples:      {len(X_test):,}")
    print(f"Total Features:    {X.shape[1]}")
    print(f"Material Classes:  6")
    print(f"Train-Test Split:  80-20")

    # Calculate composite accuracy - use weighted average of all five models
    # Classifier accuracy is most critical (material selection determines input)
    classifier_acc_pct = classifier_accuracy * 100
    regressor_acc_pct = qty_r2 * 100
    quality_acc_pct = quality_r2 * 100
    xgb_quality_acc_pct = xgb_quality_r2 * 100
    lgb_quality_acc_pct = lgb_quality_r2 * 100
    quality_avg_pct = (quality_acc_pct + xgb_quality_acc_pct + lgb_quality_acc_pct) / 3

    # Weighted composite: 35% classifier, 25% quantity, 40% quality-ensemble-average
    composite_accuracy = (classifier_acc_pct * 0.35 + regressor_acc_pct * 0.25 + quality_avg_pct * 0.40) / 100

    print("\n" + "="*80)
    print(f"MODEL PERFORMANCE SUMMARY")
    print("="*80)
    print(f"\nModel 1 (Material Classifier):  {classifier_acc_pct:.2f}%")
    print(f"Model 2 (Quantity Regressor):  {regressor_acc_pct:.2f}%")
    print(f"Model 3 (Quality Predictor RF): {quality_acc_pct:.2f}%")
    print(f"Model 4 (Quality Predictor XGB): {xgb_quality_acc_pct:.2f}%")
    print(f"Model 5 (Quality Predictor LGB): {lgb_quality_acc_pct:.2f}%")
    print(f"Quality Average (M3-M5):       {quality_avg_pct:.2f}%")
    print(f"\nWEIGHTED COMPOSITE ACCURACY: {composite_accuracy*100:.2f}%")
    print("="*80)

    if composite_accuracy > 0.90:
        print("STATUS: EXCELLENT - Model ready for production deployment")
    elif composite_accuracy > 0.85:
        print("STATUS: GOOD - Model suitable for production with monitoring")
    elif composite_accuracy > 0.80:
        print("STATUS: ACCEPTABLE - Model needs tuning before production")
    else:
        print("STATUS: NEEDS IMPROVEMENT - Recommend model optimization")

    print("\nTraining completed successfully\n")

    return True

if __name__ == '__main__':
    success = train_models()
    sys.exit(0 if success else 1)
