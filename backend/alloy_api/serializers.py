from rest_framework import serializers
from .models import (
    Alloy, AlloyComposition, AlloyRawMaterial, ProductionBatch,
    BatchRecipe, FurnaceReading, SpectrometerResult, AIRecommendation,
    Anomaly, QualityReport, Inventory, UserOperator, ActivityLog, EquipmentMaintenance,
    ModelRegistry, SmeltingRun
)

class AlloyCompositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlloyComposition
        fields = '__all__'

# Legacy compatible wrapper for Alloy Composition listing
class LegacyAlloyCompositionSerializer(serializers.ModelSerializer):
    name = serializers.CharField()
    grade = serializers.CharField(source='code')
    elements = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    class Meta:
        model = Alloy
        fields = ['id', 'name', 'grade', 'elements', 'properties', 'created_at']

    def get_elements(self, obj):
        return {c.element: c.target_pct for c in obj.compositions.all()}

    def get_properties(self, obj):
        return {"mechanical": obj.mechanical_properties}

class AlloySerializer(serializers.ModelSerializer):
    compositions = AlloyCompositionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Alloy
        fields = '__all__'

class AlloyRawMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlloyRawMaterial
        fields = '__all__'

class BatchRecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchRecipe
        fields = '__all__'

class ProductionBatchSerializer(serializers.ModelSerializer):
    recipes = BatchRecipeSerializer(many=True, read_only=True)
    
    class Meta:
        model = ProductionBatch
        fields = '__all__'

class FurnaceReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = FurnaceReading
        fields = '__all__'

# Legacy compatible wrapper for ProcessData
class ProcessDataSerializer(serializers.ModelSerializer):
    furnace_id = serializers.SerializerMethodField()
    oxygen_level = serializers.FloatField(source='oxygen_flow')
    composition_data = serializers.JSONField(source='estimated_composition')
    quality_score = serializers.FloatField(source='predicted_quality')

    class Meta:
        model = FurnaceReading
        fields = ['id', 'furnace_id', 'temperature', 'pressure', 'oxygen_level', 'composition_data', 'timestamp', 'quality_score']

    def get_furnace_id(self, obj):
        return obj.batch.batch_code if obj.batch else "F001"

class SpectrometerResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpectrometerResult
        fields = '__all__'

class AIRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRecommendation
        fields = '__all__'

class AnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = Anomaly
        fields = '__all__'

# Legacy compatible wrapper for Alert
class AlertSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='type')
    message = serializers.CharField(source='description')
    source = serializers.SerializerMethodField()
    is_resolved = serializers.BooleanField(source='resolved')
    created_at = serializers.DateTimeField(source='timestamp')

    class Meta:
        model = Anomaly
        fields = ['id', 'title', 'message', 'severity', 'source', 'is_resolved', 'created_at', 'resolved_time']

    def get_source(self, obj):
        return obj.batch.batch_code if obj.batch else "System"

class QualityReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualityReport
        fields = '__all__'

class InventorySerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source='material')
    quantity = serializers.FloatField(source='current_stock')
    material_type = serializers.SerializerMethodField()
    quality_grade = serializers.SerializerMethodField()

    class Meta:
        model = Inventory
        fields = ['id', 'material_name', 'material_type', 'quantity', 'unit', 'supplier', 'quality_grade', 'last_updated']

    def get_material_type(self, obj):
        return "raw"

    def get_quality_grade(self, obj):
        return "A"

class UserOperatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserOperator
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = '__all__'

class EquipmentMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentMaintenance
        fields = '__all__'

class ModelRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelRegistry
        fields = '__all__'

class SmeltingRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmeltingRun
        fields = '__all__'
