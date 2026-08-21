package ch.inabox.catering.service

class TemplateNotFoundException(templateId: String) :
    RuntimeException("Event template '$templateId' was not found")

class PlanResolutionException(message: String) : RuntimeException(message)
