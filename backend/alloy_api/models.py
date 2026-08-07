from django.db import models
from django.utils import timezone
import uuid

# ==========================================
# MASTER ALLOY DATABASE TABLES
# ==========================================

class Alloy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, db_index=True)  # e.g., SS-316L
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=100, db_index=True)  # e.g., Stainless Steel, Tool Steel, etc.
    standard = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    density = models.FloatField()  # g/cm³
    melting_point_min = models.IntegerField()  # °C
    melting_point_max = models.IntegerField()  # °C
    typical_applications = models.TextField(blank=True)
    recommended_furnace = models.CharField(max_length=100, default="Induction Furnace")
    estimated_holding_time = models.IntegerField(default=40)  # in minutes
    mechanical_properties = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'alloys'

    def __str__(self):
        return f"{self.name} ({self.code})"

class AlloyComposition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alloy = models.ForeignKey(Alloy, related_name='compositions', on_delete=models.CASCADE)
    element = models.CharField(max_length=10, db_index=True)  # e.g., Fe, Cr, Ni
    min_pct = models.FloatField()
    max_pct = models.FloatField()
    target_pct = models.FloatField()

    class Meta:
        db_table = 'alloy_compositions'
        unique_together = ('alloy', 'element')

    def __str__(self):
        return f"{self.alloy.code} - {self.element}: {self.target_pct}%"

class AlloyRawMaterial(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    material_name = models.CharField(max_length=100, unique=True, db_index=True)  # e.g., Ferrochrome
    purpose = models.CharField(max_length=200)
    purity = models.FloatField()  # percentage, e.g., 65.0
    estimated_recovery = models.FloatField()  # recovery coefficient, e.g., 98.5
    supplier = models.CharField(max_length=100)
    unit_cost = models.FloatField()  # cost per kg

    class Meta:
        db_table = 'alloy_raw_materials'

    def __str__(self):
        return self.material_name

# ==========================================
# BATCH & RUNNING PRODUCTION TABLES
# ==========================================

class ProductionBatch(models.Model):
    STATUS_CHOICES = [
        ('PLANNING', 'Planning'),
        ('MELTING', 'Melting'),
        ('TAPPING', 'Tapping'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch_code = models.CharField(max_length=50, unique=True, db_index=True)
    alloy = models.ForeignKey(Alloy, on_delete=models.PROTECT)
    batch_weight = models.FloatField()
    weight_unit = models.CharField(max_length=10, default="kg")
    operator = models.CharField(max_length=100)
    creation_time = models.DateTimeField(default=timezone.now, db_index=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PLANNING', db_index=True)
    estimated_completion = models.DateTimeField(null=True, blank=True)
    actual_completion = models.DateTimeField(null=True, blank=True)
    energy_used = models.FloatField(default=0.0)  # kWh
    production_duration = models.IntegerField(default=0)  # minutes
    current_stage = models.CharField(max_length=100, default="PLANNING")

    class Meta:
        db_table = 'production_batches'

    def __str__(self):
        return f"{self.batch_code} - {self.status}"

class BatchRecipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ProductionBatch, related_name='recipes', on_delete=models.CASCADE)
    material = models.CharField(max_length=100)
    theoretical_quantity = models.FloatField()
    ai_optimized_quantity = models.FloatField()
    actual_added_quantity = models.FloatField(default=0.0)
    addition_time = models.DateTimeField(null=True, blank=True)
    recovery_percentage = models.FloatField(default=95.0)

    class Meta:
        db_table = 'batch_recipes'

    def __str__(self):
        return f"{self.batch.batch_code} - {self.material}"

# ==========================================
# RUNTIME PROCESS DATA TABLES
# ==========================================

class FurnaceReading(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    batch = models.ForeignKey(ProductionBatch, related_name='readings', on_delete=models.CASCADE)
    temperature = models.FloatField()
    voltage = models.FloatField()
    current = models.FloatField()
    power = models.FloatField()
    pressure = models.FloatField()
    oxygen_flow = models.FloatField()
    energy_consumption = models.FloatField()
    predicted_quality = models.FloatField()
    predicted_completion = models.DateTimeField(null=True, blank=True)
    estimated_composition = models.JSONField(default=dict)

    class Meta:
        db_table = 'furnace_readings'

    def __str__(self):
        return f"Furnace Read - {self.batch.batch_code} - {self.timestamp}"

class SpectrometerResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ProductionBatch, related_name='spectrometer_results', on_delete=models.CASCADE)
    sample_number = models.IntegerField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    analysis_time = models.FloatField()  # seconds
    temperature = models.FloatField()
    composition = models.JSONField(default=dict)  # element percentages, e.g. {"Fe": 68.0, "Cr": 16.5}
    pass_fail = models.BooleanField(default=True)
    deviation = models.JSONField(default=dict)
    tolerance = models.JSONField(default=dict)

    class Meta:
        db_table = 'spectrometer_results'

    def __str__(self):
        return f"{self.batch.batch_code} - Sample #{self.sample_number}"

class AIRecommendation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ProductionBatch, related_name='ai_recommendations', on_delete=models.CASCADE)
    recommendation = models.TextField()
    reason = models.TextField()
    confidence = models.FloatField()
    recommended_material = models.CharField(max_length=100)
    recommended_quantity = models.FloatField()
    expected_recovery = models.FloatField()
    expected_composition = models.JSONField(default=dict)
    accepted = models.BooleanField(default=False)
    rejected = models.BooleanField(default=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    operator = models.CharField(max_length=100)

    class Meta:
        db_table = 'ai_recommendations'

    def __str__(self):
        return f"Rec - {self.batch.batch_code} - {self.recommended_material}"

class Anomaly(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    batch = models.ForeignKey(ProductionBatch, related_name='anomalies', on_delete=models.CASCADE)
    type = models.CharField(max_length=100)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES, default='medium', db_index=True)
    description = models.TextField()
    recommendation = models.TextField()
    resolved = models.BooleanField(default=False, db_index=True)
    resolved_time = models.DateTimeField(null=True, blank=True)
    operator = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'anomalies'

    def __str__(self):
        return f"Anomaly - {self.batch.batch_code} - {self.type}"

class QualityReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.OneToOneField(ProductionBatch, related_name='quality_report', on_delete=models.CASCADE)
    final_composition = models.JSONField(default=dict)
    target_composition = models.JSONField(default=dict)
    deviation = models.JSONField(default=dict)
    quality_score = models.FloatField()
    energy_used = models.FloatField()
    production_time = models.IntegerField()  # minutes
    number_of_spectrometer_samples = models.IntegerField()
    number_of_ai_recommendations = models.IntegerField()
    final_pass = models.BooleanField(default=True)
    report_file = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'quality_reports'

    def __str__(self):
        return f"Quality Report - {self.batch.batch_code}"

# ==========================================
# INVENTORY DATABASE TABLES
# ==========================================

class Inventory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    material = models.CharField(max_length=100, unique=True, db_index=True)
    current_stock = models.FloatField()
    minimum_stock = models.FloatField()
    maximum_stock = models.FloatField()
    unit = models.CharField(max_length=20)
    supplier = models.CharField(max_length=100)
    cost = models.FloatField()
    location = models.CharField(max_length=100)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory'

    def __str__(self):
        return self.material

# ==========================================
# USER & ACTIVITY TABLES
# ==========================================

class UserOperator(models.Model):
    ROLE_CHOICES = [
        ('operator', 'Operator'),
        ('engineer', 'Engineer'),
        ('manager', 'Manager'),
        ('admin', 'Admin')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100, unique=True, db_index=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='operator')
    last_active = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_operators'

    def __str__(self):
        return f"{self.username} ({self.role})"

class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operator = models.ForeignKey(UserOperator, on_delete=models.CASCADE)
    action = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'activity_logs'

    def __str__(self):
        return f"{self.operator.username} - {self.action[:30]}"

class EquipmentMaintenance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    component_name = models.CharField(max_length=100, unique=True, db_index=True)
    health_score = models.FloatField()
    estimated_remaining_life = models.CharField(max_length=100)
    last_calibration = models.DateTimeField(default=timezone.now)
    confidence_score = models.FloatField()
    maintenance_status = models.CharField(max_length=50, default="Good")
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'equipment_maintenance'

    def __str__(self):
        return f"{self.component_name} - {self.health_score}%"

class ModelRegistry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_name = models.CharField(max_length=100, unique=True, db_index=True)
    algorithm = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    accuracy = models.FloatField()
    trained_date = models.DateTimeField(default=timezone.now)
    dataset_size = models.IntegerField()

    class Meta:
        db_table = 'model_registry'

    def __str__(self):
        return f"{self.model_name} (v{self.version})"

class SmeltingRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    selected_alloy = models.ForeignKey(Alloy, on_delete=models.SET_NULL, null=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=50, default='STANDBY')
    current_stage = models.CharField(max_length=100, default='STANDBY')
    batch_id = models.CharField(max_length=100, null=True, blank=True)
    temperature = models.FloatField(default=25.0)
    power = models.FloatField(default=0.0)
    energy_consumption = models.FloatField(default=0.0)
    melt_weight = models.FloatField(default=0.0)
    batch_progress = models.FloatField(default=0.0)
    start_time = models.DateTimeField(null=True, blank=True)
    estimated_finish = models.DateTimeField(null=True, blank=True)
    predicted_quality = models.FloatField(default=0.0)
    ai_recommendation = models.JSONField(default=dict)
    input_parameters = models.JSONField(default=dict)
    recipe_generated = models.JSONField(default=dict)
    predictions = models.JSONField(default=dict)
    actual_results = models.JSONField(default=dict)

    class Meta:
        db_table = 'smelting_runs'

    def __str__(self):
        return f"Run {self.id} - Status {self.status} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
