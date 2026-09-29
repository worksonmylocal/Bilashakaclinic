### Clinic

Clinic module for Bilashaka Flower Farm

### Patient journey

Clinic Patient → Clinic Visit → Clinic Triage → Clinic Consultation → (Clinic Lab Test → back to the doctor) → Clinic Dispensing / referral out / done.

Every patient is an **Employee** or a **Community Member**. The type is copied onto the visit, consultation,
lab test, dispensing and appointment so reports can filter and split on it.

`Clinic Visit.status` is the queue and is moved by the other documents: Waiting Triage, Waiting Consultation,
In Consultation, Waiting Lab, Lab Results Ready, Waiting Pharmacy, Completed, Cancelled.
Visits with purpose **Lab Only** (e.g. referred in for tests) skip triage and consultation.

Lab test types can require patient consent (HIV): results cannot be entered until consent is recorded.

Each stage has its own web page (login required, shown according to role), with live queues, metrics and insights:
`/clinic/triage` (register, check in, vitals), `/clinic/consultation` (doctor workspace), `/clinic/lab`, `/clinic/pharmacy`.
Pages are static files in `clinic/www/clinic/`, `public/js/` and `public/css/clinic_desk.css`; data comes from `clinic/api/`.

Roles: Clinic Receptionist, Nurse, Doctor, Lab Technician, Pharmacist, Manager.
Reports: Clinic Visit Summary, Morbidity, Lab Test Summary, Employee Health by Department, Referral Register.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch version-16
bench install-app clinic
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/clinic
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
