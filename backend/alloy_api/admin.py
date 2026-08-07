from django.contrib import admin
from .models import (
    Alloy, AlloyComposition, AlloyRawMaterial, ProductionBatch,
    BatchRecipe, FurnaceReading, SpectrometerResult, AIRecommendation,
    Anomaly, QualityReport, Inventory, UserOperator, ActivityLog, EquipmentMaintenance
)

@admin.register(Alloy)
class AlloyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'standard', 'melting_point_min', 'melting_point_max']
    list_filter = ['category']
    search_fields = ['code', 'name', 'standard']

@admin.register(AlloyComposition)
class AlloyCompositionAdmin(admin.ModelAdmin):
    list_display = ['alloy', 'element', 'min_pct', 'max_pct', 'target_pct']
    list_filter = ['element']
    search_fields = ['alloy__code', 'alloy__name']

@admin.register(AlloyRawMaterial)
class AlloyRawMaterialAdmin(admin.ModelAdmin):
    list_display = ['material_name', 'purpose', 'purity', 'estimated_recovery', 'unit_cost']
    search_fields = ['material_name']

@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ['batch_code', 'alloy', 'batch_weight', 'operator', 'status', 'creation_time']
    list_filter = ['status', 'creation_time']
    search_fields = ['batch_code', 'operator']

@admin.register(BatchRecipe)
class BatchRecipeAdmin(admin.ModelAdmin):
    list_display = ['batch', 'material', 'theoretical_quantity', 'ai_optimized_quantity', 'actual_added_quantity']
    search_fields = ['batch__batch_code', 'material']

@admin.register(FurnaceReading)
class FurnaceReadingAdmin(admin.ModelAdmin):
    list_display = ['batch', 'timestamp', 'temperature', 'power', 'predicted_quality']
    list_filter = ['timestamp']
    ordering = ['-timestamp']

@admin.register(SpectrometerResult)
class SpectrometerResultAdmin(admin.ModelAdmin):
    list_display = ['batch', 'sample_number', 'timestamp', 'temperature', 'pass_fail']
    list_filter = ['pass_fail', 'timestamp']

@admin.register(AIRecommendation)
class AIRecommendationAdmin(admin.ModelAdmin):
    list_display = ['batch', 'recommended_material', 'recommended_quantity', 'confidence', 'accepted', 'rejected']
    list_filter = ['accepted', 'rejected']

@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = ['batch', 'type', 'severity', 'resolved', 'timestamp']
    list_filter = ['severity', 'resolved', 'timestamp']

@admin.register(QualityReport)
class QualityReportAdmin(admin.ModelAdmin):
    list_display = ['batch', 'quality_score', 'energy_used', 'production_time', 'final_pass']

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ['material', 'current_stock', 'minimum_stock', 'maximum_stock', 'unit', 'supplier']
    search_fields = ['material']

@admin.register(UserOperator)
class UserOperatorAdmin(admin.ModelAdmin):
    list_display = ['username', 'role', 'last_active']
    list_filter = ['role']

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['operator', 'action', 'timestamp']

@admin.register(EquipmentMaintenance)
class EquipmentMaintenanceAdmin(admin.ModelAdmin):
    list_display = ['component_name', 'health_score', 'estimated_remaining_life', 'maintenance_status', 'last_updated']

