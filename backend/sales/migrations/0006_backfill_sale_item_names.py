from django.db import migrations


def backfill_names(apps, schema_editor):
    SaleItem = apps.get_model("sales", "SaleItem")
    db_alias = schema_editor.connection.alias

    items = (
        SaleItem.objects.using(db_alias)
        .select_related("product")
        .filter(product_name="")
    )

    for item in items.iterator(chunk_size=500):
        item.product_name = item.product.name
        item.save(
            using=db_alias,
            update_fields=["product_name"]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0005_saleitem_product_name"),
    ]

    operations = [
        migrations.RunPython(
            backfill_names,
            migrations.RunPython.noop
        ),
    ]