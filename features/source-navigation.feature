Feature: Navigate from diagram units to pull request source
  Reviewers can trace every diagram unit to the exact source that produced it while retaining all existing PR Lens capabilities.

  Scenario: Publish a lens containing only source-backed units
    Given a pull request is ready for PR Lens analysis
    When PR Lens produces its graph document
    Then every diagram unit references at least one repository file
    And each reference identifies the base or head revision
    And PR Lens does not publish a lens containing a unit without a valid source reference

  Scenario: Open a unit's source from the interactive canvas
    Given a published lens was created for a specific pull request revision
    And a diagram unit references lines in a changed file
    When a reviewer selects the unit on the interactive canvas
    Then the pull request diff opens at the referenced file and lines
    And the link continues to target the analyzed revision after later commits are pushed

  Scenario: Navigate to source removed by the pull request
    Given a diagram unit references source removed by the pull request
    When a reviewer selects the unit on the interactive canvas
    Then the pull request diff opens the referenced lines on the base side
