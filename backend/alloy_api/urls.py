from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AlloyCompositionViewSet, ProcessDataViewSet, InventoryViewSet, AlertViewSet,
    AlloyViewSet, AlloyRawMaterialViewSet, ProductionBatchViewSet, BatchRecipeViewSet,
    FurnaceReadingViewSet, SpectrometerResultViewSet, AIRecommendationViewSet,
    AnomalyViewSet, QualityReportViewSet, UserOperatorViewSet, ActivityLogViewSet,
    EquipmentMaintenanceViewSet, ModelRegistryViewSet, SmeltingRunViewSet
)
from . import advanced_views

router = DefaultRouter()
router.register(r'compositions', AlloyCompositionViewSet, basename='legacy-compositions')
router.register(r'process-data', ProcessDataViewSet, basename='legacy-process-data')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'alerts', AlertViewSet, basename='legacy-alerts')

# New dedicated viewset routes with explicit basenames
router.register(r'alloys', AlloyViewSet, basename='alloys')
router.register(r'raw-materials', AlloyRawMaterialViewSet, basename='raw-materials')
router.register(r'batches', ProductionBatchViewSet, basename='batches')
router.register(r'recipes', BatchRecipeViewSet, basename='recipes')
router.register(r'readings', FurnaceReadingViewSet, basename='readings')
router.register(r'spectrometer-results', SpectrometerResultViewSet, basename='spectrometer-results')
router.register(r'recommendations', AIRecommendationViewSet, basename='recommendations')
router.register(r'anomalies', AnomalyViewSet, basename='anomalies')
router.register(r'quality-reports', QualityReportViewSet, basename='quality-reports')
router.register(r'operators', UserOperatorViewSet, basename='operators')
router.register(r'activities', ActivityLogViewSet, basename='activities')
router.register(r'equipment-maintenance', EquipmentMaintenanceViewSet, basename='equipment-maintenance')
router.register(r'model-registry', ModelRegistryViewSet, basename='model-registry')
router.register(r'smelting-runs', SmeltingRunViewSet, basename='smelting-runs')

urlpatterns = [
    path('', include(router.urls)),
    path('model/accuracy/', AlloyCompositionViewSet.as_view({'get': 'model_accuracy'}), name='model_accuracy_direct'),
    
    # Advanced AI endpoints
    path('ai/recommendations/', advanced_views.generate_recommendations, name='ai_recommendations'),
    path('ai/chat/', advanced_views.ai_chat, name='ai_chat'),
    path('ai/quality-analysis/', advanced_views.quality_analysis, name='quality_analysis'),
    path('ai/optimize-process/', advanced_views.optimize_process, name='optimize_process'),
    path('ai/predictive-maintenance/', advanced_views.predictive_maintenance, name='predictive_maintenance'),
    path('dashboard/metrics/', advanced_views.dashboard_metrics, name='dashboard_metrics'),
    
    # New Zero-Mock dynamic data endpoints
    path('landing/stats/', advanced_views.landing_stats, name='landing_stats'),
    path('models/performance/', advanced_views.model_performance, name='model_performance'),
    path('charts/production-trends/', advanced_views.production_trends, name='production_trends'),
    path('charts/material-usage/', advanced_views.material_usage, name='material_usage'),
    path('charts/process-analytics/', advanced_views.process_analytics_stats, name='process_analytics_stats'),
    path('smelting/current-run/', advanced_views.current_smelting_run, name='current_smelting_run'),
    path('smelting/start-run/', advanced_views.start_smelting_run, name='start_smelting_run'),
    path('smelting/update-run/', advanced_views.update_smelting_run, name='update_smelting_run'),
    path('furnace/current-status/', advanced_views.current_smelting_run, name='furnace_current_status'),
]
