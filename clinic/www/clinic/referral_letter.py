from clinic.web import prepare_page


def get_context(context):
    prepare_page(context, "referral_letter", any_of=("pharmacy", "consultation"))
