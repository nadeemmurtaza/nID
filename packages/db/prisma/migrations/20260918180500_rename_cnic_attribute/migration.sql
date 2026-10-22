-- AttributeType.CNIC -> NATIONAL_ID_NUMBER: generic across countries, matching
-- Subject.nationalIdNumber's own already-generic column name rather than
-- hardcoding Pakistan's specific term into a multi-country enum.
ALTER TYPE "AttributeType" RENAME VALUE 'CNIC' TO 'NATIONAL_ID_NUMBER';
