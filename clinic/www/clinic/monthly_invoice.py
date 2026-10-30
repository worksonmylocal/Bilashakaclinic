from clinic.web import prepare_page


def get_context(context):
    prepare_page(context, "monthly_invoice", any_of=("pharmacy",))
